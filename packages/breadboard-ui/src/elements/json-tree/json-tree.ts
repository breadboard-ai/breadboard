/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ToastEvent, ToastType } from "../../events/events.js";

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

  #copying = false;

  static styles = css`
    :host {
      font-family: var(--bb-font-family-mono, monospace);
      font-size: var(--bb-text-nano, 11px);
      cursor: default;
      --bb-grid-size: 4px;
      position: relative;
      display: block;
    }

    #top-level {
      width: calc(100% - 32px);
    }

    #copy-to-clipboard {
      width: 24px;
      height: 24px;
      font-size: 0;
      background: var(--bb-icon-copy-to-clipboard) center center no-repeat;
      vertical-align: middle;
      border: none;
      cursor: pointer;
      transition: opacity var(--bb-easing-duration-out) var(--bb-easing);
      opacity: 0.5;
      position: absolute;
      top: 0;
      right: 0;
      border-radius: 50%;
    }

    #copy-to-clipboard:hover {
      background-color: #ffffffcc;
      transition: opacity var(--bb-easing-duration-in) var(--bb-easing),
        background-color var(--bb-easing-duration-in) var(--bb-easing);
      opacity: 1;
    }

    :host(:hover) #copy-to-clipboard {
      display: block;
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

  async #copyToClipboard(evt: Event) {
    if (this.#copying || !this.json) {
      return;
    }

    evt.stopImmediatePropagation();
    evt.preventDefault();

    this.#copying = true;

    await navigator.clipboard.writeText(JSON.stringify(this.json, null, 2));
    this.dispatchEvent(
      new ToastEvent("JSON copied to clipboard", ToastType.INFORMATION)
    );
    this.#copying = false;
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
      <div id="top-level">${this.#convertToHtml(this.json)}</div>
      }
      <button
        id="copy-to-clipboard"
        @click=${this.#copyToClipboard}
        title="Copy JSON to Clipboard"
      >
        Copy
      </button>`;
  }
}
