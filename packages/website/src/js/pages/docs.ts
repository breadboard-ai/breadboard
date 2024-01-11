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
      display: grid;
      grid-template:
        "nav article" auto
        / 200px 1fr;
    }
    nav {
      grid-area: nav;
    }
    article {
      grid-area: article;
      max-width: 800px;
    }
  `;

  render() {
    return html`
      <bb-site-header></bb-site-header>
      <main>
        <nav>
          <ul>
            <li><a href="/docs/">Intro</a></li>
            <li><a href="/docs/concepts/">Concepts</a></li>
          </ul>
        </nav>
        <article>
          <slot></slot>
        </article>
      </main>
      <bb-site-footer></bb-site-footer>
    `;
  }
}
