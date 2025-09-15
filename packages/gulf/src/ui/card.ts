/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-card")
export class Card extends Root {
  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: #fff;
      border: 1px solid #f3f3f3;
      border-radius: 16px;
      padding: 16px;
    }

    section {
      display: block;
      border-radius: 8px;
    }
  `;

  render() {
    return html` <section>
      <slot></slot>
    </section>`;
  }
}
