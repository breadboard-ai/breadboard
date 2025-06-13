/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Orientation, Segment, SegmentType } from "../../types/particles";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { styles } from "../styles/index";
import { consume } from "@lit/context";
import { themeContext } from "../context/theme";
import { UITheme } from "../theme/default";

@customElement("ui-card")
export class UICard extends SignalWatcher(LitElement) {
  static styles = [
    styles,
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
      }

      :host([orientation="vertical"]) section {
        grid-template-rows: var(--template, 1fr);
      }

      ::slotted(*) {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        object-fit: cover;
        margin: 0;
        overflow: hidden;
      }
    `,
  ];

  @property({ reflect: true, type: String })
  accessor orientation: Orientation = Orientation.VERTICAL;

  @property()
  accessor segments: Segment[] = [
    {
      weight: 1,
      fields: {},
      orientation: Orientation.VERTICAL,
      type: SegmentType.BLOCK,
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
