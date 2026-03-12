// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Iframe entry point — bootstraps the React app and bridges postMessage.
 *
 * Mirrors Ark's iframe/entry.ts pattern:
 *  - Sends "ready" on load
 *  - Receives "render" and "update-props" messages
 *  - Exposes `window.ark` with `mutate()` for state mutations
 *  - Reports section rects for parent-frame gesture hit detection
 *  - Transparent tracker for cursors, clicks, selections
 */

import React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import App from "./App.jsx";

// ── Ark SDK ───────────────────────────────────────────────────────

/**
 * Minimal Ark SDK — the only API the React app uses to talk to the host.
 *
 * ark.mutate(path, op, value):
 *   ark.mutate("guests", "push", { name: "Kathy" })
 *   ark.mutate("tasks.0.done", "set", true)
 *   ark.mutate("notes", "set", "new text")
 *   ark.mutate("view", "set", "dayOf")
 *
 * ark.requestAgent(target, prompt):
 *   ark.requestAgent("tasks", "add some party todo items")
 */
window.ark = {
  mutate(path, op, value) {
    window.parent.postMessage({ type: "mutate", path, op, value }, "*");
  },
  requestAgent(target, prompt) {
    window.parent.postMessage({ type: "request-agent", target, prompt }, "*");
  },
};

// ── React mount ───────────────────────────────────────────────────

const root = createRoot(document.getElementById("root"));
let currentProps = {};

function render(props) {
  currentProps = { ...currentProps, ...props };
  root.render(React.createElement(App, currentProps));
}

// ── PostMessage listener ──────────────────────────────────────────

window.addEventListener("message", async (e) => {
  const { data } = e;
  if (!data || !data.type) return;

  switch (data.type) {
    case "render":
    case "update-props":
      render(data.props ?? {});
      break;

    case "capture": {
      // Parent wants a snapshot for the distortion effect.
      // html2canvas runs here where it can see the React DOM.
      const canvas = await html2canvas(document.documentElement, {
        backgroundColor: null,
        scale: window.devicePixelRatio,
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      window.parent.postMessage({ type: "capture-result", dataUrl }, "*");
      break;
    }
  }
});

// ── Section rect reporter ─────────────────────────────────────────
// Periodically reports the bounding rects of [data-section] elements
// so the parent-frame gesture layer can do hit detection without
// crossing the iframe boundary.

function reportSections() {
  const sections = document.querySelectorAll("[data-section]");
  const rects = [];
  for (const el of sections) {
    const rect = el.getBoundingClientRect();
    rects.push({
      id: el.getAttribute("data-section"),
      label: el.getAttribute("data-label") || el.getAttribute("data-section"),
      x: rect.x, y: rect.y,
      width: rect.width, height: rect.height,
    });
  }
  window.parent.postMessage({ type: "tracker", event: "sections", rects }, "*");
}

// Report on frames when visible (throttled via rAF).
let sectionReportScheduled = false;
function scheduleSectionReport() {
  if (sectionReportScheduled) return;
  sectionReportScheduled = true;
  requestAnimationFrame(() => {
    reportSections();
    sectionReportScheduled = false;
  });
}

// Report after each render and on scroll/resize.
const observer = new MutationObserver(scheduleSectionReport);
observer.observe(document.getElementById("root"), { childList: true, subtree: true });
window.addEventListener("scroll", scheduleSectionReport, { passive: true });
window.addEventListener("resize", scheduleSectionReport);

// ── Tracker (transparent instrumentation) ─────────────────────────

document.addEventListener("mousemove", (e) => {
  window.parent.postMessage({
    type: "tracker", event: "cursor",
    x: e.clientX, y: e.clientY,
  }, "*");
});

document.addEventListener("click", (e) => {
  window.parent.postMessage({
    type: "tracker", event: "click",
    x: e.clientX, y: e.clientY, t: Date.now(),
  }, "*");
});

document.addEventListener("selectionchange", () => {
  const sel = document.getSelection();
  if (!sel || !sel.rangeCount) {
    window.parent.postMessage({
      type: "tracker", event: "selection",
      collapsed: true, rects: [],
    }, "*");
    return;
  }

  const range = sel.getRangeAt(0);
  window.parent.postMessage({
    type: "tracker", event: "selection",
    collapsed: range.collapsed,
    rects: [...range.getClientRects()].map((r) => ({
      x: r.x, y: r.y, width: r.width, height: r.height,
    })),
  }, "*");
});

// ── Shortcut forwarding ───────────────────────────────────────────
// Cmd+E doesn't reach the parent document when the iframe has focus.
// Forward it via postMessage so the gesture layer can activate.

document.addEventListener("keydown", (e) => {
  if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    window.parent.postMessage({ type: "shortcut", key: "toggle-select" }, "*");
  }
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "shortcut", key: "escape" }, "*");
  }
});

// ── Signal readiness ──────────────────────────────────────────────

window.parent.postMessage({ type: "ready" }, "*");
render({});
