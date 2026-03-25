/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Iframe entry point — evaluates CJS bundles and renders React components.
 *
 * Receives `render` messages from the host with bundled CJS code,
 * evaluates them in a controlled environment with a React shim,
 * and mounts the resulting component into #root.
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";

export type { OpalApi };

// ─── Types ──────────────────────────────────────────────────────────────────

/** Messages from host → iframe. */
type HostMessage =
  | {
      type: "render";
      code: string;
      props?: Record<string, unknown>;
      assets?: Record<string, string>;
    }
  | { type: "update-props"; props: Record<string, unknown> };

/** Messages from iframe → host. */
type IframeMessage =
  | { type: "ready" }
  | { type: "navigate"; viewId: string; params?: Record<string, unknown> }
  | { type: "emit"; event: string; payload?: unknown }
  | { type: "error"; message: string; stack?: string };

/** The SDK exposed to components as `window.opalApi`. */
interface OpalApi {
  navigateTo(viewId: string, params?: Record<string, unknown>): void;
  emit(event: string, payload?: unknown): void;
  asset(name: string): string | undefined;
}

// ─── State ──────────────────────────────────────────────────────────────────

let root: Root | null = null;
let currentAssets: Record<string, string> = {};

// ─── SDK ────────────────────────────────────────────────────────────────────

function sendToHost(msg: IframeMessage): void {
  window.parent.postMessage(msg, "*");
}

/**
 * Opal SDK — the only API available to rendered components.
 *
 * Wrapped in a Proxy so hallucinated method calls from LLM-generated
 * code return no-ops instead of crashing.
 */
const sdk: OpalApi = new Proxy(
  {
    navigateTo(viewId: string, params?: Record<string, unknown>) {
      sendToHost({ type: "navigate", viewId, params });
    },
    emit(event: string, payload?: unknown) {
      sendToHost({ type: "emit", event, payload });
    },
    asset(name: string): string | undefined {
      return currentAssets[name];
    },
  },
  {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop];
      // Proxy safety: unknown methods become no-ops.
      return () => {};
    },
  }
);

// Expose globally for components.
(window as unknown as Record<string, unknown>).opalApi = sdk;
(window as unknown as Record<string, unknown>).React = React;

// ─── CJS Evaluation ────────────────────────────────────────────────────────

function requireShim(id: string): unknown {
  if (id === "react") return React;
  if (id === "react-dom/client") return { createRoot };
  throw new Error(`Cannot require "${id}" — only react is available`);
}

function evalBundle(
  code: string
): React.ComponentType<Record<string, unknown>> {
  const module = { exports: {} as Record<string, unknown> };
  const fn = new Function("React", "require", "module", "exports", code);
  fn(React, requireShim, module, module.exports);
  const Component =
    (module.exports as { default?: unknown }).default ?? module.exports;
  return Component as React.ComponentType<Record<string, unknown>>;
}

// ─── Error Boundary ─────────────────────────────────────────────────────────

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
    sendToHost({
      type: "error",
      message: error.message,
      stack: error.stack,
    });
  }

  render() {
    if (this.state.error) {
      const el = document.getElementById("error");
      if (el) {
        el.textContent = this.state.error.message;
        el.classList.add("visible");
      }
      return null;
    }
    return this.props.children;
  }
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function renderComponent(
  Component: React.ComponentType<Record<string, unknown>>,
  props: Record<string, unknown> = {}
): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  // Clear any previous error display.
  const errorEl = document.getElementById("error");
  if (errorEl) errorEl.classList.remove("visible");

  if (!root) {
    root = createRoot(rootEl);
  }

  root.render(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(Component, { ...props, opalApi: sdk })
    )
  );
}

// ─── Message Handler ────────────────────────────────────────────────────────

let currentComponent: React.ComponentType<Record<string, unknown>> | null =
  null;

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as HostMessage;
  if (!msg || typeof msg.type !== "string") return;

  switch (msg.type) {
    case "render": {
      try {
        currentAssets = msg.assets ?? {};
        currentComponent = evalBundle(msg.code);
        renderComponent(currentComponent, msg.props);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        sendToHost({
          type: "error",
          message: error.message,
          stack: error.stack,
        });
        const el = document.getElementById("error");
        if (el) {
          el.textContent = error.message;
          el.classList.add("visible");
        }
      }
      break;
    }

    case "update-props": {
      if (currentComponent) {
        renderComponent(currentComponent, msg.props);
      }
      break;
    }
  }
});

// ─── Bootstrap ──────────────────────────────────────────────────────────────

sendToHost({ type: "ready" });
