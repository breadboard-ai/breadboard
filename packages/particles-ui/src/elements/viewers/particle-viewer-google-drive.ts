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
import { ItemData, ParticleViewer, UITheme } from "../../types/types.js";
import { merge } from "../../utils/utils.js";

@customElement("particle-viewer-google-drive")
export class ParticleViewerGoogleDrive
  extends LitElement
  implements ParticleViewer
{
  @property({ reflect: true, type: String })
  accessor containerOrientation: Orientation | null = null;

  @property({ attribute: true, type: String })
  accessor value: ItemData[string] | null = null;

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

    return html`<a
      class=${classMap(
        merge(
          this.theme.elements.a,
          this.field.modifiers?.includes("hero")
            ? this.theme.modifiers.hero
            : {}
        )
      )}
      href=${`https://drive.google.com/open?id=${this.value}`}
      target="_blank"
      >Google Drive File<span class="g-icon filled round layout-ml-2"
        >open_in_new</span
      ></a
    >`;
  }
}
