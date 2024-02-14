/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject } from "@google-labs/breadboard";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-error")
export class BoardError extends LitElement {
  @property()
  message: string | ErrorObject | null = null;

  static styles = css`
    :host {
      display: block;
      font-family: var(--bb-font-family-mono, monospace);
      font-size: var(--bb-text-nano, 11px);
      padding: calc(var(--bb-grid-size) * 2) 0;
      color: var(--bb-error-color);
    }
  `;

  render() {
    if (typeof this.message === "string") return html`${this.message}`;
    return html`<div id="error">
        ${JSON.stringify(this.message?.error, null, 2)}
      </div>
      <div id="descriptor">in: "${this.message?.descriptor.id}"</div>`;
  }
}
