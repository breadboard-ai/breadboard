/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bundle Mapper — converts parsed multipart parts into a ViewBundle.
 *
 * Two modes:
 * - **Single view** (default): all files go into one view called "main".
 * - **Journey mode**: when a `journey.json` is present, each state in
 *   the machine becomes a separate view with its own files and navigation
 *   graph derived from the state machine's transitions.
 */

import type { ViewBundle, ViewDescriptor } from "../types.js";
import { type BundlePart } from "./multipart.js";

export { mapPartsToBundle };

/**
 * Map parsed multipart parts into a ViewBundle ready for the iframe pipeline.
 */
function mapPartsToBundle(runId: string, parts: BundlePart[]): ViewBundle {
  const allFiles: Record<string, string> = {};
  const assets: Record<string, { type: string; url: string }> = {};
  let journeySpec: JourneySpec | null = null;

  for (const part of parts) {
    const text = new TextDecoder().decode(part.body);

    if (part.filename === "journey.json") {
      try {
        journeySpec = JSON.parse(text) as JourneySpec;
      } catch {
        console.warn("[bundle-mapper] Failed to parse journey.json");
      }
    } else if (
      part.filename.endsWith(".jsx") ||
      part.filename.endsWith(".css")
    ) {
      allFiles[part.filename] = text;
    } else if (part.filename.endsWith(".md")) {
      // Skip markdown files (SKILL.md, domain skills, etc.)
    } else {
      const blob = new Blob([part.body as unknown as BlobPart], {
        type: part.contentType,
      });
      assets[part.filename] = {
        type: part.contentType,
        url: URL.createObjectURL(blob),
      };
    }
  }

  // Journey mode: one view per state — but only when the agent
  // produced per-state views WITHOUT a monolithic App.jsx. When
  // App.jsx exists, the agent built a single component that manages
  // its own routing (switch statement over state), so we serve it
  // as a single view with all files.
  if (journeySpec && !allFiles["App.jsx"]) {
    const views = buildJourneyViews(journeySpec, allFiles);
    if (views.length > 0) {
      return { id: runId, views, assets };
    }
    // Fall through to single-view if journey parsing yields no views.
  }

  // Single-view mode (default).
  return {
    id: runId,
    views: [
      {
        id: "main",
        label: "Generated UI",
        files: allFiles,
        props: {},
      },
    ],
    assets,
  };
}

// ─── Journey Types ─────────────────────────────────────────────────────────────

interface JourneySpec {
  objective: string;
  outcome: string;
  machine: {
    id: string;
    initial: string;
    context?: Record<string, unknown>;
    states: Record<string, JourneyState>;
  };
  viewHints?: Record<string, string>;
}

interface JourneyState {
  type?: string;
  meta?: {
    purpose?: string;
    displays?: string[];
  };
  on?: Record<string, string | { target: string }>;
}

// ─── Journey View Builder ──────────────────────────────────────────────────────

/**
 * Build ViewDescriptors from a journey spec + the generated files.
 *
 * Matching strategy: for each state named "foo_bar", look for a view
 * file matching the state name in several conventions:
 * - `views/FooBar.jsx` (PascalCase)
 * - `views/foo_bar.jsx` (snake_case)
 * - `FooBar.jsx` (flat PascalCase)
 *
 * Shared files (styles.css, components/*) are included in every view.
 */
function buildJourneyViews(
  spec: JourneySpec,
  allFiles: Record<string, string>
): ViewDescriptor[] {
  const states = spec.machine.states;
  const stateNames = Object.keys(states);

  // Identify shared files (not state-specific views).
  const sharedFiles: Record<string, string> = {};
  const viewFiles = new Map<string, Record<string, string>>();

  for (const [path, content] of Object.entries(allFiles)) {
    if (path === "styles.css" || path.startsWith("components/")) {
      sharedFiles[path] = content;
    }
  }

  // Match each state to its view file(s).
  for (const stateName of stateNames) {
    const pascal = snakeToPascal(stateName);
    const candidates = [
      `views/${pascal}.jsx`,
      `views/${stateName}.jsx`,
      `${pascal}.jsx`,
    ];

    const matched: Record<string, string> = { ...sharedFiles };
    for (const candidate of candidates) {
      if (allFiles[candidate]) {
        // The view file becomes the entry point — rename to App.jsx
        // so the iframe pipeline finds it.
        matched["App.jsx"] = allFiles[candidate];
        break;
      }
    }

    // If no dedicated view found, check if App.jsx exists and this
    // is the only state (backwards compat with single-view agent output).
    if (!matched["App.jsx"] && allFiles["App.jsx"] && stateNames.length === 1) {
      matched["App.jsx"] = allFiles["App.jsx"];
    }

    if (matched["App.jsx"]) {
      viewFiles.set(stateName, matched);
    }
  }

  // If we couldn't match any states to files, bail.
  if (viewFiles.size === 0) return [];

  // Build ViewDescriptors with navigation graph.
  const views: ViewDescriptor[] = [];

  // Put the initial state first.
  const ordered = [
    spec.machine.initial,
    ...stateNames.filter((s) => s !== spec.machine.initial),
  ].filter((s) => viewFiles.has(s));

  for (const stateName of ordered) {
    const state = states[stateName];
    const files = viewFiles.get(stateName)!;

    // Extract navigation targets from transitions.
    const navigatesTo: string[] = [];
    if (state.on) {
      for (const transition of Object.values(state.on)) {
        const target =
          typeof transition === "string" ? transition : transition.target;
        if (target && !navigatesTo.includes(target)) {
          navigatesTo.push(target);
        }
      }
    }

    views.push({
      id: stateName,
      label: state.meta?.purpose ?? snakeToPascal(stateName),
      files,
      props: { journeyContext: spec.machine.context ?? {} },
      navigatesTo: navigatesTo.length > 0 ? navigatesTo : undefined,
    });
  }

  return views;
}

/** Convert snake_case to PascalCase: "input_requirements" → "InputRequirements" */
function snakeToPascal(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}
