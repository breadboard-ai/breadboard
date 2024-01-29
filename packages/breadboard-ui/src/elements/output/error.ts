/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-error")
export class BoardError extends LitElement {
  @property()
  message: string | null = null;

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
    return html`${this.message}`;
  }
}
