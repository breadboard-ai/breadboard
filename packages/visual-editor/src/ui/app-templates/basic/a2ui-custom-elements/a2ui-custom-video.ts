/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
} from "../../../utils/youtube.js";
import { until } from "lit/directives/until.js";

@customElement("a2ui-custom-video")
export class A2UICustomVideo extends A2UI.v0_8.UI.Root {
  @property()
  accessor fileUri: A2UI.v0_8.Primitives.StringValue | null = null;

  @property()
  accessor url: A2UI.v0_8.Primitives.StringValue | null = null;

  static styles = [
    css`
      :host {
        display: block;
      }

      iframe,
      video {
        display: block;
        width: 100%;
        border-radius: var(--a2ui-video-radius, 20px);
      }

      iframe {
        aspect-ratio: 16/9;
        border: none;

        &.vertical {
          aspect-ratio: 9/16;
        }
      }

      video {
        object-fit: cover;
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

  #renderVideoElement(videoUri: string) {
    let uri: string | null = videoUri;
    const isVertical = isShortsUri(uri);
    if (isWatchUri(uri) || isShortsUri(uri)) {
      uri = convertWatchOrShortsUriToEmbedUri(uri);
    } else if (isShareUri(uri)) {
      uri = convertShareUriToEmbedUri(uri);
    }

    if (isEmbedUri(uri)) {
      return html`<iframe
        class=${isVertical ? "vertical" : ""}
        src="${uri}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>`;
    } else {
      if (!uri) {
        return html`<p>Unable to obtain video.</p>`;
      }

      const videoUrl = fetch(uri)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          this.#blobUrls.push(blobUrl);
          return blobUrl;
        });

      return html`<video src=${until(videoUrl)} controls></video>`;
    }
  }

  #renderVideo() {
    const fileUri = A2UI.v0_8.UI.Utils.extractStringValue(
      this.fileUri,
      this.component,
      this.processor,
      this.surfaceId
    );
    const url = A2UI.v0_8.UI.Utils.extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    const videoUrl = fileUri || url;
    if (!videoUrl) {
      return html`<p>Unable to obtain video.</p>`;
    }

    return this.#renderVideoElement(videoUrl);
  }

  render() {
    return html`<section>${this.#renderVideo()}</section>`;
  }
}
