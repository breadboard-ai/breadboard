/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-list")
export class List extends Root {
  static styles = css`
    :host {
      display: grid;
      gap: 8px;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}
