/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  Field,
  FieldName,
  Orientation,
  ParticleData,
} from "@breadboard-ai/particles";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { themeContext } from "../../context/theme.js";
import { ParticleViewer, UITheme } from "../../types/types.js";
import * as Styles from "../../styles/index.js";
import { appendToAll, merge } from "../../utils/utils.js";
import { markdown } from "../../directives/markdown.js";

@customElement("particle-viewer-long-text")
export class ParticleViewerLongText
  extends LitElement
  implements ParticleViewer
{
  @property({ reflect: true, type: String })
  accessor containerOrientation: Orientation | null = null;

  @property({ attribute: true, type: String })
  accessor value: ParticleData | null = null;

  @property()
  accessor fieldName: FieldName | null = null;

  @property()
  accessor field: Field | null = null;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    Styles.all,
    css`
      :host {
        display: block;
        overflow: hidden;
      }

      section {
        display: grid;
        height: 100%;
      }
    `,
  ];

  render() {
    if (!this.value || !this.field || !this.theme) {
      return nothing;
    }

    if (this.field.behaviors?.includes("editable")) {
      return html`<textarea
        .id=${this.fieldName}
        .name=${this.fieldName}
        .value=${this.value ?? ""}
        .placeholder=${this.field.title ?? "Enter a value"}
        class=${classMap(
          merge(
            this.theme.elements.textarea,
            this.field.modifiers?.includes("hero")
              ? this.theme.modifiers.hero
              : {}
          )
        )}
      ></textarea>`;
    }

    return html`<section class="layout-w-100">
      ${markdown(
        this.value as string,
        appendToAll(
          this.theme.markdown,
          ["ol", "ul", "li"],
          this.field.modifiers?.includes("hero")
            ? this.theme.modifiers.hero
            : {}
        )
      )}
    </section>`;
  }
}
