/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Iframe entry point — runs inside the sandboxed iframe.
 *
 * Exposes React as a global for CJS component code, sets up a require shim,
 * and listens for host messages. Adapted from Ark's iframe/entry.ts with
 * the Ark SDK removed (not needed for this spike).
 */

import React from "react";
import { createRoot } from "react-dom/client";
import * as WidgetMap from "./widgets/Map.js";
import * as WidgetScoreBar from "./widgets/ScoreBar.js";
import * as WidgetStarRating from "./widgets/StarRating.js";

export {};

// ─── Globals ─────────────────────────────────────────────────────────────────

(window as unknown as Record<string, unknown>).React = React;

// ─── Widget Registry ─────────────────────────────────────────────────────────

// Mark with __esModule so esbuild's __toESM helper doesn't double-wrap.
const widgets: Record<string, unknown> = {
  "@widgets/Map": { default: WidgetMap.default, __esModule: true },
  "@widgets/ScoreBar": { default: WidgetScoreBar.default, __esModule: true },
  "@widgets/StarRating": {
    default: WidgetStarRating.default,
    __esModule: true,
  },
};

// ─── Require Shim ────────────────────────────────────────────────────────────

function requireShim(id: string): unknown {
  if (id === "react" || id.startsWith("react/")) return React;
  if (id === "react-dom/client") return { createRoot };
  if (widgets[id]) return widgets[id];
  console.warn(`[cg-iframe] Unknown require("${id}")`);
  return {};
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RenderMessage {
  type: "render";
  code: string;
  props: Record<string, unknown>;
}

interface UpdatePropsMessage {
  type: "update-props";
  props: Record<string, unknown>;
}

type HostMessage = RenderMessage | UpdatePropsMessage;

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

function handleRender(msg: RenderMessage) {
  const { code, props } = msg;

  try {
    const moduleShim = { exports: {} as Record<string, unknown> };
    const fn = new Function("React", "require", "module", "exports", code);
    fn(React, requireShim, moduleShim, moduleShim.exports);

    const Component = (moduleShim.exports.default ??
      moduleShim.exports) as React.ComponentType<Record<string, unknown>>;

    const rootEl = document.getElementById("root")!;

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
window.parent.postMessage({ type: "ready" }, "*");
