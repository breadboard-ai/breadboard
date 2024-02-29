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
let BreadboardSiteHeader = class BreadboardSiteHeader extends LitElement {
    static { this.styles = css `
    header {
      position: sticky;
      top: 0;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 18px;
      border-bottom: 1px solid #ccc;
    }
    #logo {
      display: flex;
      align-items: center;
    }
    h1 {
      font-size: 24px;
      margin-left: 10px;
      font-weight: normal;
    }
    nav {
      text-decoration: none;
      display: flex;
      align-items: center;
    }
    nav > a {
      padding: 8px 12px;
    }
  `; }
    render() {
        return html `
      <header>
        <a id="logo" href="/">
          <img
            src="/static/breadboard.png"
            alt="Breadboard logo"
            width="30px"
            height="30px"
          />
          <h1>Breadboard</h1>
        </a>
        <nav>
          <a href="/docs/">Docs</a>
          <a href="/playground/">Playground</a>
          <a
            href="https://github.com/breadboard-ai/breadboard/"
            target="_blank"
            rel="noopener"
            title="Breadboard on GitHub"
            aria-label="Breadboard on GitHub"
            ><img src="/static/github.svg" />
          </a>
        </nav>
      </header>
    `;
    }
};
BreadboardSiteHeader = __decorate([
    customElement("bb-site-header")
], BreadboardSiteHeader);
export { BreadboardSiteHeader };
//# sourceMappingURL=header.js.map