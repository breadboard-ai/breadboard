/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DESIGN_TOKENS_CSS } from "../design/tokens.js";
import { registry, type GeneratedComponent } from "../core/registry.js";

export { renderComponentInIframe };

/**
 * Transform JSX code to plain JS via the server-side esbuild endpoint.
 */
async function transformJSX(code: string): Promise<string> {
  const res = await fetch("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`JSX transform failed: ${err.error}`);
  }

  const data = await res.json();
  return data.code;
}

/**
 * Create an iframe that renders a React component with the full token system.
 *
 * The iframe loads a proper Vite-served page (`/iframe.html`) which imports
 * React via the module system. Component code and tokens are sent via
 * postMessage after the iframe signals readiness.
 */
async function renderComponentInIframe(
  container: HTMLElement,
  component: GeneratedComponent
): Promise<HTMLIFrameElement> {
  // Remove existing iframe if any.
  const existing = container.querySelector("iframe");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "width: 100%; height: 100%; border: none;";
  container.appendChild(iframe);

  // Gather all dependency components that are referenced in this component's code.
  const deps = findDependencies(component);

  // Build the combined code: shared constants + dependency functions + this component.
  // Use a Set to deduplicate shared code blocks (same-generation components
  // share identical sharedCode strings) and prevent redeclaration errors.
  const codeBlocks: string[] = [];
  const seenNames = new Set<string>();
  const seenShared = new Set<string>();

  // Prepend shared code (constants, style objects) from this component's generation.
  if (component.sharedCode) {
    seenShared.add(component.sharedCode);
    codeBlocks.push(component.sharedCode);
  }

  // Add dependencies in order.
  for (const d of deps) {
    if (!seenNames.has(d.componentName)) {
      seenNames.add(d.componentName);
      // Add the dependency's shared code if we haven't seen it yet.
      if (d.sharedCode && !seenShared.has(d.sharedCode)) {
        seenShared.add(d.sharedCode);
        codeBlocks.push(d.sharedCode);
      }
      codeBlocks.push(d.code);
    }
  }

  // Add this component's own code.
  codeBlocks.push(component.code);

  const allJSX = deduplicateDeclarations(codeBlocks.join("\n\n"));

  // Prepend a comprehensive React import. The model sometimes omits imports
  // entirely, referencing hooks as bare globals. Esbuild's CJS format converts
  // this into `require('react')`, which the iframe's requireShim maps to the
  // global React. Any duplicate imports the model included are stripped by the
  // parser, so this is always the single source of truth.
  const REACT_IMPORT = [
    "import React, {",
    "  useState, useEffect, useRef, useCallback, useMemo,",
    "  useContext, useReducer, useLayoutEffect,",
    "  memo, forwardRef, createContext, Fragment",
    "} from 'react';",
  ].join("\n");
  const compiledCode = await transformJSX(`${REACT_IMPORT}\n\n${allJSX}`);

  // Navigate the iframe to the Vite-served page.
  iframe.src = "/iframe.html";

  // Wait for the iframe to signal it's ready, then send the component code.
  await new Promise<void>((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data?.type === "iframe-ready" &&
        event.source === iframe.contentWindow
      ) {
        window.removeEventListener("message", handler);

        iframe.contentWindow!.postMessage(
          {
            type: "render-component",
            code: compiledCode,
            componentName: component.componentName,
            tokens: DESIGN_TOKENS_CSS,
          },
          "*"
        );

        resolve();
      }
    };
    window.addEventListener("message", handler);
  });

  return iframe;
}

/**
 * Find all previously generated components that are referenced in the
 * given component's source code. Uses a visited set to prevent infinite
 * recursion when sub-components share the same code block.
 */
function findDependencies(
  component: GeneratedComponent,
  visited = new Set<string>()
): GeneratedComponent[] {
  visited.add(component.tag);
  const deps: GeneratedComponent[] = [];
  for (const other of registry.all()) {
    if (other.tag === component.tag) continue;
    if (visited.has(other.tag)) continue;
    if (component.code.includes(other.componentName)) {
      visited.add(other.tag);
      const subDeps = findDependencies(other, visited);
      for (const sub of subDeps) {
        if (!deps.some((d) => d.tag === sub.tag)) {
          deps.push(sub);
        }
      }
      if (!deps.some((d) => d.tag === other.tag)) {
        deps.push(other);
      }
    }
  }
  return deps;
}

/**
 * Strip duplicate top-level `const` declarations from combined code.
 *
 * When multiple code blocks are stitched together, the model often repeats
 * `const { useState, useEffect, ... } = React;` before each function.
 * esbuild rejects these as redeclarations. This function keeps only the
 * first occurrence of each unique `const` line.
 */
function deduplicateDeclarations(code: string): string {
  const lines = code.split("\n");
  const seenConsts = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Only deduplicate top-level const declarations (not inside functions).
    // We identify these as lines starting with `const ` that aren't indented.
    if (trimmed.startsWith("const ") && line === trimmed) {
      if (seenConsts.has(trimmed)) continue;
      seenConsts.add(trimmed);
    }
    result.push(line);
  }

  return result.join("\n");
}
