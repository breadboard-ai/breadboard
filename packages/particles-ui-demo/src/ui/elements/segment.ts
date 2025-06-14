/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { merge } from "../styles/utils";
import { Field, Orientation } from "../../types/particles";
import { styles } from "../styles";
import { consume } from "@lit/context";
import { themeContext } from "../context/theme";
import { UITheme } from "../theme/default";

@customElement("ui-segment")
export class UISegment extends SignalWatcher(LitElement) {
  @property()
  accessor fields: Record<string, Field> | null = null;

  @property()
  accessor values: Record<string, unknown> | null = null;

  @property()
  accessor containerOrientation: Orientation = "vertical";

  @property({ reflect: true, type: Boolean })
  accessor disabled = false;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  #renderField(
    fieldName: string,
    field: Field,
    value: unknown,
    theme: UITheme
  ) {
    switch (field.as) {
      case "image": {
        if (!field.src) {
          return html`Unable to render image - no source provided.`;
        }

        return html`<ui-hero-image
          class=${classMap(theme.components.heroImage)}
          .containerOrientation=${this.containerOrientation}
        >
          <img
            src=${field.src}
            slot="hero"
            class=${classMap(theme.modifiers.cover)}
            alt=${field.title}
          />
          ${field.title && field.modifiers?.includes("hero")
            ? html`<h1
                slot="headline"
                class=${classMap(
                  merge(
                    theme.elements.h1,
                    theme.modifiers.headline,
                    this.containerOrientation === "horizontal"
                      ? theme.elements.h3
                      : {}
                  )
                )}
              >
                ${field.title}
              </h1>`
            : nothing}
        </ui-hero-image>`;
      }

      case "date":
      case "text": {
        if (field.behaviors?.includes("editable")) {
          return html`<input
            .id=${fieldName}
            .name=${fieldName}
            .value=${value}
            .placeholder=${field.title ?? "Enter a value"}
            ?disabled=${this.disabled}
            type=${field.as}
            class=${classMap(
              merge(
                theme.elements.input,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          />`;
        }
        return html`<p
          class=${classMap(
            merge(
              theme.elements.p,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
          ${value}
        </p>`;
      }

      case "longtext": {
        if (field.behaviors?.includes("editable")) {
          return html`<textarea
            .id=${fieldName}
            .name=${fieldName}
            .value=${value ?? ""}
            .placeholder=${field.title ?? "Enter a value"}
            ?disabled=${this.disabled}
            class=${classMap(
              merge(
                theme.elements.textarea,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          ></textarea>`;
        }
        return html`<p
          class=${classMap(
            merge(
              theme.elements.p,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
          ${value}
        </p>`;
      }

      case "behavior":
        return html`<ui-button
          class=${classMap(theme.elements.button)}
          data-behavior=${fieldName}
          .icon=${field.icon ?? null}
        >
          ${field.title ?? "Action"}
        </ui-button>`;

      default:
        return html`Unknown field`;
    }
  }

  render() {
    if (!this.fields || !this.values || !this.theme) {
      return nothing;
    }

    const values = this.values;
    const theme = this.theme;

    return html` ${repeat(Object.entries(this.fields), ([fieldName, field]) => {
      const value = values[fieldName];
      return this.#renderField(fieldName, field, value, theme);
    })}`;
  }
}
