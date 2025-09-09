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
import { consume } from "@lit/context";
import { themeContext } from "../../context/theme.js";
import * as Styles from "../../styles/index.js";
import { ParticleViewer, UITheme } from "../../types/types.js";

@customElement("particle-viewer-google-drive")
export class ParticleViewerGoogleDrive
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
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        overflow: hidden;
      }

      a {
        display: inline-flex;
        align-items: center;
      }
    `,
  ];

  render() {
    if (!this.value || !this.field || !this.theme) {
      return nothing;
    }

    const fileId = this.value.substring("drive:/".length);
    return html`<bb-google-drive-file-viewer
      .fileId=${fileId}
    ></bb-google-drive-file-viewer>`;
  }
}
