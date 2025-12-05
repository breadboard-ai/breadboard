/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { consume } from "@lit/context";
import { themeContext } from "../../context/theme.js";

import {
  Field,
  FieldName,
  Orientation,
  ParticleData,
} from "@breadboard-ai/particles";
import { ItemData, ParticleViewer, UITheme } from "../../types/types.js";
import * as Styles from "../../styles/index.js";

@customElement("particle-ui-segment")
export class ParticleUISegment extends SignalWatcher(LitElement) {
  @property()
  accessor fields: Record<FieldName, Field> | null = null;

  @property()
  accessor values: Record<FieldName, ParticleData> | null = null;

  @property()
  accessor containerOrientation: Orientation = "vertical";

  @property({ reflect: true, type: Boolean })
  accessor disabled = false;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    Styles.all,
    css`
      * {
        box-sizing: border-box;
        flex: 1;
      }

      :host {
        display: flex;
        flex: var(--weight, 1) 0;
      }
    `,
  ];

  #renderField(
    fieldName: string,
    field: Field,
    value: ItemData[string],
    theme: UITheme
  ) {
    const ElementConstructor = customElements.get(field.as);
    if (!ElementConstructor) {
      return html`Unknown field type: ${field.as}`;
    }

    const element: ParticleViewer = new ElementConstructor() as ParticleViewer;
    if (theme.viewers[field.as]) {
      element.className = Object.keys(theme.viewers[field.as]).join(" ");
    } else {
      console.warn(`No styles for ${field.as}`);
    }
    element.containerOrientation = this.containerOrientation;
    element.fieldName = fieldName;
    element.field = field;
    element.value = value;

    return html`${element}`;
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
