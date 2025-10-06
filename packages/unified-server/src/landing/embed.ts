/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, unsafeCSS, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../third_party/lite-yt-embed/lite-yt-embed.js";
import CSS from "../third_party/lite-yt-embed/lite-yt-embed.css?raw";

@customElement("bb-lite-embed")
export class LiteEmbed extends LitElement {
  @property()
  accessor videoId: string | null = null;

  static styles = [
    unsafeCSS(CSS),
    css`
      :host {
        display: block;
      }

      lite-youtube {
        max-width: none;

        &::before {
          display: none;
        }
      }
    `,
  ];

  render() {
    if (!this.videoId) {
      return nothing;
    }

    return html`<lite-youtube
      videoid=${this.videoId}
      style="background-image: url('https://i.ytimg.com/vi/${this
        .videoId}/maxresdefault.jpg');"
    >
      <a
        href="https://youtube.com/watch?v=${this.videoId}"
        class="lyt-playbtn"
        title="Play Video"
      >
        <span class="lyt-visually-hidden">Play Video</span>
      </a>
    </lite-youtube>`;
  }
}
