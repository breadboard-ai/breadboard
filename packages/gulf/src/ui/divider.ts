/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-divider")
export class Divider extends Root {
  static styles = css`
    :host {
      display: block;
    }

    hr {
      height: 1px;
      background: #ccc;
      border: none;
    }
  `;

  render() {
    return html`<hr />`;
  }
}
