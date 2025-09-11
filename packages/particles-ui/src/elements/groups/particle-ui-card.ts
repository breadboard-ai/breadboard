/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import * as Styles from "../../styles/index.js";
import { Orientation, Segment } from "@breadboard-ai/particles";
import { themeContext } from "../../context/theme.js";
import { UITheme } from "../../types/types.js";

@customElement("particle-ui-card")
export class ParticleUICard extends SignalWatcher(LitElement) {
  static styles = [
    Styles.all,
    css`
      * {
        box-sizing: border-box;
      }

      :host([orientation="horizontal"]) {
        display: flex;
        overflow: hidden;
        flex-direction: row;
        align-items: center;
      }

      :host([orientation="vertical"]) {
        display: grid;
        grid-auto-rows: min-content;
      }
    `,
  ];

  @property({ reflect: true, type: String })
  accessor orientation: Orientation = "vertical";

  @property()
  accessor segments: Segment[] = [
    {
      weight: 1,
      fields: {},
      orientation: "vertical",
      type: "block",
    },
  ];

  @property({ reflect: true, type: Boolean })
  accessor disabled = false;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  render() {
    if (!this.theme) {
      return nothing;
    }

    return repeat(this.segments, (_, idx) => {
      return html` <slot name=${`slot-${idx}`}></slot> `;
    });
  }
}
