/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ElementType, Orientation, Segment } from "../../types/types";
import { repeat } from "lit/directives/repeat.js";
import { styles, theme } from "../styles/default";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";

@customElement("ui-card")
export class UICard extends SignalWatcher(LitElement) {
  @property({ reflect: true, type: String })
  accessor orientation: Orientation = Orientation.VERTICAL;

  @property()
  accessor segments: Segment[] = [
    {
      weight: 1,
      fields: {},
      orientation: Orientation.VERTICAL,
      type: ElementType.CARD,
    },
  ];

  @property({ reflect: true, type: Boolean })
  accessor disabled = false;

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
    return html`<section
      class=${classMap(this.disabled ? theme.modifiers.disabled : {})}
    >
      ${repeat(this.segments, (_, idx) => {
        return html` <slot name=${`slot-${idx}`}></slot> `;
      })}
    </section>`;
  }
}
