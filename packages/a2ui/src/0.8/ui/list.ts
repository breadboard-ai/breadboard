/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import * as Styles from "./styles";
import { classMap } from "lit/directives/class-map.js";

@customElement("a2ui-list")
export class List extends Root {
  @property({ reflect: true, type: String })
  accessor direction: "vertical" | "horizontal" = "vertical";

  static styles = [
    Styles.all,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
      }

      :host([direction="vertical"]) section {
        display: grid;
      }

      :host([direction="horizontal"]) section {
        display: flex;
        max-width: 100%;
        overflow-x: scroll;
        overflow-y: hidden;
        scrollbar-width: none;

        > ::slotted(*) {
          flex: 1 0 fit-content;
          max-width: min(80%, 400px);
        }
      }
    `,
  ];

  render() {
    return html`<section class=${classMap(this.theme.components.List)}>
      <slot></slot>
    </section>`;
  }
}
