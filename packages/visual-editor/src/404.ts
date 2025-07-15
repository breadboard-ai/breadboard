/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

console.log(Strings);

@customElement("page-not-found")
export class PageNotFound extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100svw;
      height: 100svh;
      align-items: center;
      justify-content: center;
    }

    h1 {
      margin: 0 0 12px 0;
    }
  `;

  render() {
    return html`<h1>Page not found</h1>
      <p>Please go to the <a href="/">${Strings.from("APP_NAME")} Home</a></p>`;
  }
}
