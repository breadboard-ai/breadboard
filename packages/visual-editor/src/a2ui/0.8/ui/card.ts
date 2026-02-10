/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root.js";

/**
 * Card container component.
 *
 * Provides a rounded, padded surface for grouping child components.
 * Renders children into its light DOM via the inherited Root behavior,
 * then projects them through a shadow DOM slot.
 */
@customElement("a2ui-card")
export class Card extends Root {
  static styles = [
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
        height: 100%;
        width: 100%;
        min-height: 0;
        overflow: auto;
        border-radius: var(--a2ui-card-radius, var(--a2ui-border-radius-xl));
        background: var(--a2ui-card-bg, var(--a2ui-color-surface));
        padding: var(--a2ui-card-padding, var(--a2ui-spacing-6));

        ::slotted(*) {
          height: 100%;
          width: 100%;
        }
      }
    `,
  ];

  render() {
    return html` <section>
      <slot></slot>
    </section>`;
  }
}
