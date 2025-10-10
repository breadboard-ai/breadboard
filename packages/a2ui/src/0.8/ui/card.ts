/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root";
import * as Styles from "./styles";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("a2ui-card")
export class Card extends Root {
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

      section {
        display: flex;
        height: 100%;
        min-height: 0;
        overflow: auto;
      }
    `,
  ];

  render() {
    return html` <section
      class=${classMap(this.theme.components.Card)}
      style=${this.theme.additionalStyles?.Card
        ? styleMap(this.theme.additionalStyles?.Card)
        : nothing}
    >
      <slot></slot>
    </section>`;
  }
}
