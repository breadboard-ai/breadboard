/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Field,
  FieldName,
  isDataParticle,
  Orientation,
  Particle,
} from "@breadboard-ai/particles";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";
import { themeContext } from "../../context/theme.js";
import * as Styles from "../../styles/index.js";
import { ParticleViewer, UITheme } from "../../types/types.js";

@customElement("particle-viewer-audio")
export class ParticleViewerAudio extends LitElement implements ParticleViewer {
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

    if (!isDataParticle(this.value) || typeof this.value.data !== "string") {
      return html`Unable to render audio: URL is not valid`;
    }

    const audioUrl = fetch(this.value.data)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        this.#blobUrls.push(blobUrl);
        return blobUrl;
      });

    return html`<section class="layout-pos-rel">
      <audio
        class=${classMap(this.theme.elements.audio)}
        src=${until(audioUrl)}
        controls
      ></audio>
    </section>`;
  }
}
