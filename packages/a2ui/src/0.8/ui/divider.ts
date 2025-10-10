/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";
import * as Styles from "./styles";

@customElement("a2ui-divider")
export class Divider extends Root {
  static styles = [
    Styles.all,
    css`
      :host {
        display: block;
        min-height: 0;
        overflow: auto;
      }

      hr {
        height: 1px;
        background: #ccc;
        border: none;
      }
    `,
  ];

  render() {
    return html`<hr />`;
  }
}
