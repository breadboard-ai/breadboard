/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-site-footer")
export class BreadboardSiteFooter extends LitElement {
  static styles = css`
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      font-family: sans-serif;
      border-top: 1px solid #ccc;
    }
  `;

  render() {
    return html`<footer>Copyright Google 2024</footer>`;
  }
}
