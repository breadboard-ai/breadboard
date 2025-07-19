/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Field,
  FieldName,
  isTextParticle,
  Orientation,
  Particle,
} from "@breadboard-ai/particles";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { themeContext } from "../../context/theme.js";
import { markdown } from "../../directives/markdown.js";
import * as Styles from "../../styles/index.js";
import { ParticleViewer, UITheme } from "../../types/types.js";
import { appendToAll, merge } from "../../utils/utils.js";

@customElement("particle-viewer-text")
export class ParticleViewerText extends LitElement implements ParticleViewer {
  @property({ reflect: true, type: String })
  accessor containerOrientation: Orientation | null = null;

  @property()
  accessor value: Particle | null = null;

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

    if (!isTextParticle(this.value)) return nothing;

    if (this.field.behaviors?.includes("editable")) {
      return html`<input
        .id=${this.fieldName}
        .name=${this.fieldName}
        .value=${this.value.text}
        .placeholder=${this.field.title ?? "Enter a value"}
        type="text"
        class=${classMap(
          merge(
            this.theme.elements.input,
            this.field.modifiers?.includes("hero")
              ? this.theme.modifiers.hero
              : {}
          )
        )}
      />`;
    }

    return html`<section class="layout-w-100">
      ${markdown(
        this.value.text,
        appendToAll(
          this.theme.markdown,
          [],
          this.field.modifiers?.includes("hero")
            ? this.theme.modifiers.hero
            : {}
        )
      )}
    </section>`;
  }
}
