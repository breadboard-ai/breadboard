/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

type JSONObjectValue = number | string | boolean | JSONObject;

interface JSONObject {
  [key: string]: JSONObjectValue;
}

@customElement("bb-json-tree")
export class JSONTree extends LitElement {
  @property({ reflect: false })
  json: JSONObject | null = null;

  @property({ reflect: true })
  autoExpand = false;

  static styles = css`
    :host {
      font-family: var(--bb-font-family-mono, monospace);
      font-size: var(--bb-text-nano, 11px);
      cursor: default;
      --bb-grid-size: 4px;
    }

    summary,
    .preview,
    .key {
      margin-left: 0;
    }

    details[open] > summary .preview {
      display: none;
    }

    .number {
      color: rgb(0, 0, 255);
    }

    .string {
      color: rgb(0, 118, 15);
    }

    .boolean {
      color: rgb(33, 200, 210);
    }

    .key {
      color: var(--bb-font-color, rgb(68, 61, 116));
      font-weight: bold;
    }

    .empty {
      font-style: italic;
    }

    * > * {
      margin: calc(var(--bb-grid-size) * 0.5) 0 0 calc(var(--bb-grid-size) * 4);
    }
  `;

  #createPreview(value: JSONObjectValue) {
    if (Array.isArray(value)) {
      return value.length > 0 ? "[...]" : "[]";
    }

    if (typeof value === "object") {
      return Object.keys(value).length > 0 ? "{...}" : "{}";
    }

    return value;
  }

  #formatValue(value: JSONObjectValue) {
    if (typeof value === "string") {
      return `"${value}"`;
    }

    return value;
  }

  #convertToHtml(obj: JSONObject) {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      if (Array.isArray(obj)) {
        return html`<div class="empty">length: 0</div>`;
      }

      return html`<div class="empty">{}</div>`;
    }

    return html`${entries.map(([key, value]): HTMLTemplateResult => {
      const type = typeof value;
      const preview = this.#createPreview(value);
      if (type === "object") {
        return html`<details ?open=${this.autoExpand}>
          <summary>
            <span class="key">${key}: </span>
            <span class="preview">${preview}</span>
          </summary>
          ${this.#convertToHtml(value as JSONObject)}
        </details>`;
      }

      return html`<div class="${type}">
        <span class="key">${key}: </span>${this.#formatValue(value)}
      </div>`;
    })}`;
  }

  render() {
    if (this.json === null) {
      return nothing;
    }

    return html`{
      <div>${this.#convertToHtml(this.json)}</div>
      }`;
  }
}
