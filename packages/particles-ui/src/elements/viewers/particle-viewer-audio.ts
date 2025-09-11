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
import { until } from "lit/directives/until.js";
import { themeContext } from "../../context/theme.js";
import * as Styles from "../../styles/index.js";
import { ParticleViewer, UITheme } from "../../types/types.js";

@customElement("particle-viewer-audio")
export class ParticleViewerAudio extends LitElement implements ParticleViewer {
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
        display: flex;
        overflow: hidden;
        flex: 1 1 fit-content;
      }

      :host > * {
        flex: 1;
        width: 100%;
      }

      audio {
        display: block;
      }
    `,
  ];

  #blobUrls: string[] = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();

    for (const url of this.#blobUrls) {
      URL.revokeObjectURL(url);
    }
  }

  render() {
    if (!this.value || !this.field || !this.theme) {
      return nothing;
    }

    if (typeof this.value !== "string") {
      return html`Unable to render audio: URL is not valid`;
    }

    const audioUrl = fetch(this.value)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        this.#blobUrls.push(blobUrl);
        return blobUrl;
      });

    return html` <audio
      class=${classMap(this.theme.elements.audio)}
      src=${until(audioUrl)}
      controls
    ></audio>`;
  }
}
