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
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
} from "../../utils/youtube.js";
import { themeContext } from "../../context/theme.js";
import * as Styles from "../../styles/index.js";
import { ParticleViewer, UITheme } from "../../types/types.js";
import { merge } from "../../utils/utils.js";

@customElement("particle-viewer-video")
export class ParticleViewerVideo extends LitElement implements ParticleViewer {
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
      }

      iframe:not([srcdoc]) {
        width: 100%;
        aspect-ratio: 16/9;
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

    let uri: string | null = this.value;
    if (isWatchUri(uri) || isShortsUri(uri)) {
      uri = convertWatchOrShortsUriToEmbedUri(uri);
    } else if (isShareUri(uri)) {
      uri = convertShareUriToEmbedUri(uri);
    }

    if (isEmbedUri(uri)) {
      return html`<iframe
        class=${classMap(this.theme.elements.iframe)}
        src="${uri}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>`;
    } else {
      if (!uri) {
        return html`<p
          class=${classMap(
            merge(this.theme.elements.p, this.theme.modifiers.hero)
          )}
        >
          Unable to obtain video.
        </p>`;
      }

      const videoUrl = fetch(uri)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          this.#blobUrls.push(blobUrl);
          return blobUrl;
        });

      return html`<video
        class=${classMap(this.theme.elements.video)}
        src=${until(videoUrl)}
        controls
      ></video>`;
    }
  }
}
