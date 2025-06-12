/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Orientation } from "../../types/types";
import { repeat } from "lit/directives/repeat.js";
import { styles, theme } from "../styles/default";
import { classMap } from "lit/directives/class-map.js";

@customElement("ui-card")
export class Card extends LitElement {
  @property({ reflect: true, type: String })
  accessor orientation: Orientation = Orientation.VERTICAL;

  @property({ reflect: true, type: Array })
  accessor segments: Array<string | number> = [1];

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
        background: var(--n-100);
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
        .map((r) => `${typeof r === "number" ? `${r}fr` : r}`)
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
      ${repeat(this.segments, () => {
        return html`<slot></slot>`;
      })}
    </section>`;
  }
}
