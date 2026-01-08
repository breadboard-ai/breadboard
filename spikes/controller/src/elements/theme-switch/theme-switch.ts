/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "../root.js";
import { isHydrating } from "../../controller/utils/hydration.js";
import * as Styles from "../../styles/styles.js";

@customElement("theme-switch")
export class ThemeSwitch extends Root {
  static styles = [
    Styles.Theme.colorScheme,
    Styles.Icons.icons,
    css`
      :host {
        display: block;
      }

      button {
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        cursor: pointer;
      }

      span {
        display: block;
        width: 400px;
        font-size: 32px;
        pointer-events: none;
      }
    `,
  ];

  render() {
    if (!this.controller) return nothing;

    const mode = this.controller.theme.mode;
    return isHydrating(mode)
      ? html`Pending`
      : html`
        <button
          @click=${() => {
            if (!this.controller) return;
            this.controller.theme.toggleMode();
          }}
        >
          <span class="g-icon filled-heavy round">${
            mode === "dark" ? "dark_mode" : "light_mode"
          }</div>
        </button>
      `;
  }
}
