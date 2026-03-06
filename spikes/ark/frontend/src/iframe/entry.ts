/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Iframe entry point — runs inside the sandboxed iframe.
 *
 * Imports React via Vite's module system, exposes it as a global for
 * CJS component code, installs the Ark SDK, and listens for host messages.
 *
 * Ported from the Component Generator experiment with stricter message
 * handling and the addition of the Ark SDK.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import type { HostMessage, ArkSDK } from "../types.js";

export {};

// ─── Globals ─────────────────────────────────────────────────────────────────

// Expose React so CJS `require("react")` resolves to the real thing.
(window as unknown as Record<string, unknown>).React = React;

// ─── Require Shim ────────────────────────────────────────────────────────────
// esbuild CJS output calls `require("react")`. We intercept that here.

function requireShim(id: string): unknown {
  if (id === "react" || id.startsWith("react/")) return React;
  if (id === "react-dom/client") return { createRoot };
  console.warn(`[ark-iframe] Unknown require("${id}")`);
  return {};
}

// ─── Ark SDK ─────────────────────────────────────────────────────────────────
// The ONLY way components can talk to the host. No raw postMessage access.

let currentAssets: Record<string, string> = {};

const ark: ArkSDK = {
  navigateTo(viewId: string, params?: Record<string, unknown>) {
    window.parent.postMessage({ type: "navigate", viewId, params }, "*");
  },

  emit(event: string, payload?: unknown) {
    window.parent.postMessage({ type: "emit", event, payload }, "*");
  },

  asset(name: string): string | undefined {
    return currentAssets[name];
  },
};

(window as unknown as Record<string, unknown>).ark = ark;

// ─── React State ─────────────────────────────────────────────────────────────

let currentComponent: React.ComponentType<Record<string, unknown>> | null =
  null;
let currentRoot: ReturnType<typeof createRoot> | null = null;
let currentProps: Record<string, unknown> = {};

// ─── Error Boundary ──────────────────────────────────────────────────────────

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
    // Report the error to the host.
    window.parent.postMessage(
      { type: "error", message: error.message, stack: error.stack },
      "*"
    );

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
            padding: "16px",
            margin: "16px",
            background: "#450a0a",
            color: "#fecaca",
            borderRadius: "8px",
            fontFamily: "monospace",
            fontSize: "13px",
            whiteSpace: "pre-wrap" as const,
          },
        },
        `⚠ Component crashed:\n\n${this.state.error.message}`
      );
    }
    return this.props.children;
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

function handleMessage(event: MessageEvent<HostMessage>) {
  const { data } = event;
  if (!data || typeof data !== "object" || !("type" in data)) return;

  switch (data.type) {
    case "render":
      handleRender(data);
      break;
    case "update-props":
      currentProps = data.props;
      rerender();
      break;
  }
}

function handleRender(msg: HostMessage & { type: "render" }) {
  const { code, componentName, props, assets } = msg;

  // Update the SDK's asset map.
  currentAssets = assets;

  try {
    // CJS shims: esbuild output uses require() and module.exports.
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

    const rootEl = document.getElementById("root")!;

    // Tear down previous root if it exists.
    if (currentRoot) {
      currentRoot.unmount();
    }

    const root = createRoot(rootEl);
    currentComponent = Component;
    currentRoot = root;
    currentProps = props;

    root.render(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement(Component, props)
      )
    );

    // Clear any previous error.
    const errorEl = document.getElementById("error");
    if (errorEl) errorEl.style.display = "none";
  } catch (err) {
    window.parent.postMessage(
      {
        type: "error",
        message: (err as Error).message,
        stack: (err as Error).stack,
      },
      "*"
    );

    const errorEl = document.getElementById("error");
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent =
        (err as Error).message + "\n\n" + (err as Error).stack;
    }
  }
}

function rerender() {
  if (!currentComponent || !currentRoot) return;
  const Component = currentComponent;
  currentRoot.render(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(Component, currentProps)
    )
  );
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

window.addEventListener("message", handleMessage);

// Signal readiness to the host.
window.parent.postMessage({ type: "ready" }, "*");
