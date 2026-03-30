/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Iframe entry point — runs inside the sandboxed iframe.
 *
 * Imports React via Vite's module system, exposes it as a global for
 * CJS component code, installs the Ark SDK, and listens for host messages.
 */

import React from "react";
import { createRoot } from "react-dom/client";

export {};

// ─── Types ───────────────────────────────────────────────────────────────────

/** Messages the host sends TO the iframe. */
export type HostMessage =
  | {
      type: "render";
      code: string;
      css?: string;
      props: Record<string, unknown>;
      assets: Record<string, string>;
    }
  | { type: "update-props"; props: Record<string, unknown> }
  | { type: "host.chat.switch"; payload: { ticket_id: string; role: string } };

/** Messages the iframe sends TO the host. */
export type IframeMessage =
  | { type: "ready" }
  | { type: "navigate"; viewId: string; params?: Record<string, unknown> }
  | { type: "emit"; event: string; payload?: unknown }
  | { type: "error"; message: string; stack?: string };

export interface OpalSDK {
  navigateTo(viewId: string, params?: Record<string, unknown>): void;
  emit(event: string, payload?: unknown): void;
  asset(name: string): string | undefined;
}

// ─── Globals ─────────────────────────────────────────────────────────────────

// Expose React so CJS `require("react")` resolves to the real thing.
(window as unknown as Record<string, unknown>).React = React;

// ─── Require Shim ────────────────────────────────────────────────────────────
// esbuild CJS output calls `require("react")`. We intercept that here.

function requireShim(id: string): unknown {
  if (id === "react" || id.startsWith("react/")) return React;
  if (id === "react-dom/client") return { createRoot };
  console.warn(`[bees-iframe] Unknown require("${id}")`);
  return {};
}

// ─── Opal SDK ─────────────────────────────────────────────────────────────────
// The ONLY way components talk to the host. No raw postMessage access.

let currentAssets: Record<string, string> = {};

const opalSDK: OpalSDK = {
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

// Proxy guards against hallucinated API calls.
const safeOpalSDK = new Proxy(opalSDK, {
  get(target, prop, receiver) {
    if (prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    console.warn(
      `[opal-sdk] Unknown method "${String(prop)}" — ` +
        `available: navigateTo, emit, asset`
    );
    return () => {};
  },
});

(window as unknown as Record<string, unknown>).opalSDK = safeOpalSDK;

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
            background: "var(--cg-color-error-container)",
            color: "var(--cg-color-on-error-container)",
            borderRadius: "var(--cg-radius-sm)",
            fontFamily: "var(--cg-font-mono)",
            fontSize: "var(--cg-text-body-sm-size)",
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
  const { code, css, props, assets } = msg;

  currentAssets = assets;

  try {
    // Inject CSS if provided.
    if (css) {
      let styleEl = document.getElementById("bundle-css") as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "bundle-css";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    }

    // CJS shims: esbuild output uses require() and module.exports.
    const moduleShim = { exports: {} as Record<string, unknown> };
    const fn = new Function("React", "require", "module", "exports", code);
    fn(React, requireShim, moduleShim, moduleShim.exports);

    // esbuild CJS sets exports.default for `export default App`.
    const Component = (moduleShim.exports.default ??
      moduleShim.exports) as React.ComponentType<Record<string, unknown>>;

    const rootEl = document.getElementById("root")!;

    // Tear down previous root.
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
