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
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { ResolvedRow } from "../types/types.js";

/**
 * Horizontal flex layout container.
 *
 * Arranges children in a row with configurable `alignment` (cross-axis)
 * and `distribution` (main-axis). Gap is controlled by the
 * `--a2ui-row-gap` token (default: `--a2ui-spacing-4`).
 */
@customElement("a2ui-row")
export class Row extends Root {
  @property({ reflect: true, type: String })
  accessor alignment: ResolvedRow["alignment"] = "stretch";

  @property({ reflect: true, type: String })
  accessor distribution: ResolvedRow["distribution"] = "start";

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex: var(--weight);
      }

      section {
        display: flex;
        flex-direction: row;
        width: 100%;
        min-height: 100%;
        gap: var(--a2ui-row-gap, var(--a2ui-spacing-4));
      }

      :host([alignment="start"]) section {
        align-items: start;
      }

      :host([alignment="center"]) section {
        align-items: center;
      }

      :host([alignment="end"]) section {
        align-items: end;
      }

      :host([alignment="stretch"]) section {
        align-items: stretch;
      }

      :host([distribution="start"]) section {
        justify-content: start;
      }

      :host([distribution="center"]) section {
        justify-content: center;
      }

      :host([distribution="end"]) section {
        justify-content: end;
      }

      :host([distribution="spaceBetween"]) section {
        justify-content: space-between;
      }

      :host([distribution="spaceAround"]) section {
        justify-content: space-around;
      }

      :host([distribution="spaceEvenly"]) section {
        justify-content: space-evenly;
      }
    `,
  ];

  render() {
    return html`<section>
      <slot></slot>
    </section>`;
  }
}
