/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared helpers for rendering collapsible JSON trees and
 * expand/collapse toggles. Used by log-detail and the ticket
 * file browser.
 *
 * These are plain functions returning Lit TemplateResult values,
 * not a custom element — so they can be called from any component
 * that includes `jsonTreeStyles` in its static styles.
 */

import { html, nothing } from "lit";

export { renderJson, renderExpandButton, handleToggleExpand };

/** Render a collapsible JSON tree for an arbitrary value. */
function renderJson(obj: unknown, depth = 0): unknown {
  if (obj === null || obj === undefined) {
    return html`<span class="json-null">${String(obj)}</span>`;
  }
  if (typeof obj !== "object") {
    return renderJsonValue(obj);
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) {
    return html`<span class="json-empty"
      >${Array.isArray(obj) ? "[]" : "{}"}</span
    >`;
  }
  return html`${entries.map(([key, value]) => {
    if (value !== null && typeof value === "object") {
      const preview = Array.isArray(value)
        ? value.length > 0
          ? `[${value.length}]`
          : "[]"
        : Object.keys(value as Record<string, unknown>).length > 0
          ? "{…}"
          : "{}";
      return html`<details class="json-node" ?open=${depth < 3}>
        <summary>
          <span class="json-key">${key}</span>
          <span class="json-preview">${preview}</span>
        </summary>
        <div class="json-children">${renderJson(value, depth + 1)}</div>
      </details>`;
    }
    return html`<div class="json-leaf">
      <span class="json-key">${key}:</span>
      ${renderJsonValue(value)}
    </div>`;
  })}`;
}

function renderJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return html`<span class="json-null">${String(value)}</span>`;
  }
  const type = typeof value;
  if (type === "string") {
    const str = value as string;
    const isLong = str.length > 200;
    return html`<span class="json-string ${isLong ? "long" : ""}"
      >${JSON.stringify(str)}${isLong
        ? renderExpandButton()
        : nothing}</span
    >`;
  }
  if (type === "number") {
    return html`<span class="json-number">${value}</span>`;
  }
  if (type === "boolean") {
    return html`<span class="json-boolean">${value}</span>`;
  }
  return html`<span>${String(value)}</span>`;
}

/** Render a small expand/collapse toggle button. */
function renderExpandButton() {
  return html`<button class="expand-toggle" @click=${handleToggleExpand}>
    »
  </button>`;
}

/** Click handler for expand/collapse toggle. */
function handleToggleExpand(e: Event) {
  const btn = e.currentTarget as HTMLElement;
  const container = btn.parentElement;
  if (!container) return;
  const expanded = container.classList.toggle("expanded");
  btn.textContent = expanded ? "«" : "»";
}
