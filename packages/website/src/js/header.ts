/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-site-header")
export class BreadboardSiteHeader extends LitElement {
  static styles = css`
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
  `;

  render() {
    return html`
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
}
