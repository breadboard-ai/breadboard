/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-carousel")
export class Carousel extends Root {
  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    section {
      display: flex;
      gap: 8px;
      max-width: 100%;
      overflow-x: scroll;
      overflow-y: hidden;

      > ::slotted(*) {
        flex: 1 0 fit-content;
      }
    }
  `;

  render() {
    return html`<section><slot></slot></section>`;
  }
}
