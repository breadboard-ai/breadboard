/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Iframe entry point — runs inside the component preview iframe.
 *
 * Properly imports React via Vite's module resolution, then listens
 * for postMessage from the host to receive compiled component code
 * and design tokens.
 */

import React from "react";
import { createRoot } from "react-dom/client";

// Expose React as a global so compiled component code can use
// React.createElement (classic JSX transform output).
window.React = React;

/**
 * Module shim for CJS-formatted code from esbuild.
 *
 * esbuild `format: "cjs"` converts:
 *   import React, { useState } from 'react'  →  var import_react = require("react")
 *   export default function Foo()             →  module.exports = Foo
 *
 * We provide `require` and `module`/`exports` so the CJS code can run
 * in a new Function() context. No regex stripping needed.
 */
function requireShim(id: string): unknown {
  // All react-related imports point at the global React.
  if (id === "react" || id.startsWith("react/")) return React;
  if (id === "react-dom/client") return { createRoot };
  console.warn(`[iframe] Unknown require("${id}")`);
  return {};
}

interface RenderMessage {
  type: "render-component";
  code: string;
  componentName: string;
  tokens: string;
}

interface ThemeMessage {
  type: "update-theme";
  css: string;
}

interface UpdatePropsMessage {
  type: "update-props";
  props: Record<string, unknown>;
}

type IframeMessage = RenderMessage | ThemeMessage | UpdatePropsMessage;

// Stored for re-renders when props change.
let currentComponent: React.ComponentType<Record<string, unknown>> | null =
  null;
let currentRoot: ReturnType<typeof createRoot> | null = null;
let currentProps: Record<string, unknown> = {};

window.addEventListener("message", (event: MessageEvent<IframeMessage>) => {
  if (event.data?.type === "update-theme") {
    // Swap the theme override CSS without re-rendering the component.
    let themeEl = document.getElementById("theme-override");
    if (!themeEl) {
      themeEl = document.createElement("style");
      themeEl.id = "theme-override";
      document.head.appendChild(themeEl);
    }
    themeEl.textContent = event.data.css ?? "";
    return;
  }

  if (event.data?.type === "update-props") {
    currentProps = event.data.props;
    rerenderWithProps();
    return;
  }

  if (event.data?.type !== "render-component") return;

  const { code, componentName, tokens } = event.data;

  // Inject design tokens.
  const tokensEl = document.getElementById("tokens");
  if (tokensEl) tokensEl.textContent = tokens;

  // Execute the compiled component code and render it.
  try {
    // esbuild CJS output uses `require()` for imports and
    // `module.exports`/`exports.X` for exports. We provide shims.
    const moduleShim = { exports: {} as Record<string, unknown> };

    const fn = new Function(
      "React",
      "require",
      "module",
      "exports",
      code +
        `\nreturn typeof ${componentName} !== 'undefined' ? ${componentName} : module.exports.default || module.exports;`
    );

    const Component = fn(React, requireShim, moduleShim, moduleShim.exports);

    // ErrorBoundary catches runtime React render crashes (e.g. .map() on undefined).
    class ErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { error: Error | null }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error: Error) {
        return { error };
      }
      componentDidCatch(error: Error) {
        const errorEl = document.getElementById("error");
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = error.message + "\n\n" + error.stack;
        }
      }
      render() {
        if (this.state.error) {
          return React.createElement(
            "div",
            {
              style: {
                padding: "var(--cg-sp-4)",
                background: "var(--cg-color-error-container)",
                color: "var(--cg-color-on-error-container)",
                borderRadius: "var(--cg-radius-sm)",
                fontFamily: "var(--cg-font-mono)",
                fontSize: "13px",
                whiteSpace: "pre-wrap" as const,
                margin: "var(--cg-sp-4)",
              },
            },
            `⚠ Component crashed:\n\n${this.state.error.message}`
          );
        }
        return this.props.children;
      }
    }

    const rootEl = document.getElementById("root")!;
    const root = createRoot(rootEl);
    currentComponent = Component;
    currentRoot = root;
    currentProps = {};
    root.render(
      React.createElement(ErrorBoundary, null, React.createElement(Component))
    );

    // Hide any previous error.
    const errorEl = document.getElementById("error");
    if (errorEl) errorEl.style.display = "none";
  } catch (err) {
    const errorEl = document.getElementById("error");
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent =
        (err as Error).message + "\n\n" + (err as Error).stack;
    }
  }
});

// Signal readiness to the host.
window.parent.postMessage({ type: "iframe-ready" }, "*");

// ─── Re-render with updated props ───────────────────────────────────────────

function rerenderWithProps(): void {
  if (!currentComponent || !currentRoot) return;

  const Component = currentComponent;
  currentRoot.render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(Component, currentProps)
    )
  );
}
