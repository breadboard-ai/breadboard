/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
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

      :host {
        display: block;
        overflow: hidden;
      }

      section {
        display: grid;
        overflow: hidden;
      }

      :host([orientation="horizontal"]) section {
        grid-template-columns: var(--template, 1fr);
        grid-template-rows: min-content;
      }

      :host([orientation="vertical"]) section {
        grid-template-rows: var(--template, 1fr);
        grid-template-rows: min-content;
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

  #setTemplate() {
    this.style.setProperty(
      "--template",
      this.segments
        .map(
          (r) => `${typeof r.weight === "number" ? `${r.weight}fr` : r.weight}`
        )
        .join(" ")
    );
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("segments")) {
      this.#setTemplate();
    }
  }

  render() {
    if (!this.theme) {
      return nothing;
    }

    return html`<section
      class=${classMap(this.disabled ? this.theme.modifiers.disabled : {})}
    >
      ${repeat(this.segments, (_, idx) => {
        return html` <slot name=${`slot-${idx}`}></slot> `;
      })}
    </section>`;
  }
}
