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
      font-family: sans-serif;
      font-weight: normal;
    }
    nav {
      font-family: sans-serif;
      text-decoration: none;
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
        </nav>
      </header>
    `;
  }
}
