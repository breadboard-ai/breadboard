/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import "../header.js";
import "../footer.js";

@customElement("bb-site-docs")
export class BreadboardSiteDocs extends LitElement {
  static styles = css`
    main {
      padding: 16px;
    }
  `;
  render() {
    return html`
      <bb-site-header></bb-site-header>
      <main>
        <h2>Docs</h2>
      </main>
      <bb-site-footer></bb-site-footer>
    `;
  }
}
