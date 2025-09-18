/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-list")
export class List extends Root {
  @property({ reflect: true, type: String })
  accessor direction: "vertical" | "horizontal" = "vertical";

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      flex: var(--weight);
    }

    :host([direction="vertical"]) section {
      display: grid;
      gap: 8px;

      > ::slotted(*) {
        gap: 8px;
      }
    }

    :host([direction="horizontal"]) section {
      display: flex;
      gap: 8px;
      max-width: 100%;
      overflow-x: scroll;
      overflow-y: hidden;

      > ::slotted(*) {
        flex: 1 0 fit-content;
        max-width: min(80%, 400px);
      }
    }
  `;

  render() {
    return html`<section><slot></slot></section>`;
  }
}
