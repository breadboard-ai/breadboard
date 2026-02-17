/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, NodeDescriptor, NodeValue } from "@breadboard-ai/types";
import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { hash } from "@breadboard-ai/utils";

export { takeSnapshot, diffSnapshots, type GraphSnapshot };

// =============================================================================
// Types
// =============================================================================

type StepSnapshot = {
  title: string;
  promptHash: number;
};

type GraphSnapshot = {
  steps: Map<string, StepSnapshot>;
  connections: Set<string>;
};

// =============================================================================
// Snapshot
// =============================================================================

/**
 * Capture a lightweight snapshot of the graph for later diffing.
 * Uses pidgin handles so diffs read naturally.
 */
function takeSnapshot(
  nodes: NodeDescriptor[],
  edges: Edge[],
  translator: EditingAgentPidginTranslator
): GraphSnapshot {
  const steps = new Map<string, StepSnapshot>();
  for (const node of nodes) {
    const handle = translator.getOrCreateHandle(node.id);
    const title = node.metadata?.title ?? "(untitled)";
    const prompt = node.configuration?.["config$prompt"];
    const promptHash = prompt ? hash(prompt as NodeValue) : 0;
    steps.set(handle, { title, promptHash });
  }

  const connections = new Set<string>();
  for (const edge of edges) {
    const from = translator.getOrCreateHandle(edge.from);
    const to = translator.getOrCreateHandle(edge.to);
    connections.add(`${from} -> ${to}`);
  }

  return { steps, connections };
}

// =============================================================================
// Diff
// =============================================================================

/**
 * Compare two graph snapshots and return a human-readable summary of changes.
 * Returns `null` if the snapshots are identical.
 */
function diffSnapshots(
  before: GraphSnapshot,
  after: GraphSnapshot
): string | null {
  const changes: string[] = [];

  // Added or modified steps
  for (const [handle, step] of after.steps) {
    const prev = before.steps.get(handle);
    if (!prev) {
      changes.push(`- Added step ${handle} "${step.title}"`);
    } else {
      if (prev.title !== step.title) {
        changes.push(
          `- Changed title of ${handle} from "${prev.title}" to "${step.title}"`
        );
      }
      if (prev.promptHash !== step.promptHash) {
        changes.push(`- Changed prompt of ${handle} "${step.title}"`);
      }
    }
  }

  // Removed steps
  for (const [handle, step] of before.steps) {
    if (!after.steps.has(handle)) {
      changes.push(`- Removed step ${handle} "${step.title}"`);
    }
  }

  // Added connections
  for (const conn of after.connections) {
    if (!before.connections.has(conn)) {
      changes.push(`- Added connection: ${conn}`);
    }
  }

  // Removed connections
  for (const conn of before.connections) {
    if (!after.connections.has(conn)) {
      changes.push(`- Removed connection: ${conn}`);
    }
  }

  if (changes.length === 0) return null;
  return changes.join("\n");
}
