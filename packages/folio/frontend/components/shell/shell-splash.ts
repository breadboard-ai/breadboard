/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("o-shell-splash")
export class ShellSplash extends LitElement {
  static styles = [
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        color: var(--opal-color-on-surface);
      }

      .spinner {
        width: var(--opal-grid-10);
        height: var(--opal-grid-10);
        border: var(--opal-grid-1) solid var(--opal-color-border-subtle);
        border-top: var(--opal-grid-1) solid var(--opal-color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ];

  render() {
    return html`<div class="spinner"></div>`;
  }
}
