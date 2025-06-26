/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Field, FieldName, Orientation } from "@breadboard-ai/particles";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { themeContext } from "../../context/theme.js";
import * as Styles from "../../styles/index.js";
import { ItemData, ParticleUIElement, UITheme } from "../../types/types.js";
import { merge } from "../../utils/utils.js";

@customElement("particle-ui-button")
export class ParticleUIButton extends LitElement implements ParticleUIElement {
  @property({ reflect: true, type: String })
  accessor containerOrientation: Orientation | null = null;

  @property({ attribute: true, type: String })
  accessor value: ItemData[string] | null = null;

  @property()
  accessor fieldName: FieldName | null = null;

  @property()
  accessor field: Field | null = null;

  @property()
  accessor disabled = false;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    Styles.all,
    css`
      :host {
        overflow: hidden;
        display: flex;
        align-items: center;
        position: relative;
      }

      div {
        display: flex;
        align-items: center;
        width: min-content;
        pointer-events: none;
        white-space: nowrap;
        background: inherit;
        color: inherit;
        font: inherit;
        border: none;
        outline: none;
      }

      :host([disabled][showspinnerwhendisabled]) .g-icon {
        animation: rotate 1s linear infinite;
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  render() {
    if (!this.value || !this.field || !this.theme) {
      return nothing;
    }

    return html`<div
      tabindex="0"
      @click=${() => {
        this.disabled = true;
      }}
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key === "Enter" || evt.key === " ") {
          this.click();
        }
      }}
      class=${classMap(
        merge(
          this.theme.elements.button,
          this.field.modifiers?.includes("hero")
            ? this.theme.modifiers.hero
            : {}
        )
      )}
    >
      ${this.field.icon
        ? html`<span class="g-icon filled round layout-mr-2"
            >${this.disabled ? "progress_activity" : this.field.icon}</span
          >`
        : nothing}
      ${this.field.title}
    </div>`;
  }
}
