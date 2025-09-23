/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-column")
export class Column extends Root {
  static styles = css`
    :host {
      display: grid;
      gap: 8px;
      flex: var(--weight);
    }

    ::slotted(*) {
      > ::slotted(*) {
        flex: var(--weight);
      }
      align-items: flex-start;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}
