/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import "../header.js";
import "../footer.js";

@customElement("bb-site-landing")
export class BreadboardSiteLanding extends LitElement {
  static styles = css`
    main {
      padding: 16px;
    }
  `;
  render() {
    return html`
      <bb-site-header></bb-site-header>
      <main>
        <p>Welcome to Breadboard!</p>
      </main>
      <bb-site-footer></bb-site-footer>
    `;
  }
}
