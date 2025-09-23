/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-row")
export class Row extends Root {
  static styles = css`
    :host {
      display: flex;
      gap: 16px;
      flex: var(--weight);
    }

    ::slotted(*) {
      flex: var(--weight);
      align-items: flex-start;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}
