/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "../header.js";
import "../footer.js";
let BreadboardSiteDocs = class BreadboardSiteDocs extends LitElement {
    static { this.styles = css `
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
  `; }
    render() {
        return html `
      <bb-site-header></bb-site-header>
      <main>
        <nav>
          <ul>
            <li><a href="/docs/">Intro</a></li>
            <li><a href="/docs/getting-started/">Getting Started</a></li>
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
};
BreadboardSiteDocs = __decorate([
    customElement("bb-site-docs")
], BreadboardSiteDocs);
export { BreadboardSiteDocs };
//# sourceMappingURL=docs.js.map