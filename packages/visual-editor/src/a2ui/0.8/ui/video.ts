/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { html, css, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { extractStringValue } from "./utils/utils.js";
import { classMap } from "lit/directives/class-map.js";
import { icons } from "../styles/icons.js";

/**
 * Video player component.
 *
 * Resolves its source URL from a `StringValue` using `extractStringValue`
 * and renders a native `<video>` element with controls.
 */
@customElement("a2ui-video")
export class Video extends Root {
  @property()
  accessor url: StringValue | null = null;

  @state()
  accessor #loaded = false;

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("url")) {
      this.#loaded = false;
    }
  }

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: hidden;
        padding: var(--a2ui-video-padding, 0);
      }

      video {
        display: block;
        width: 100%;
        border-radius: var(--a2ui-video-radius, 20px);
        object-fit: cover;
      }

      video.loading {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .loading-message {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        aspect-ratio: 16 / 9;
        border-radius: var(--a2ui-video-radius, 20px);
        color: var(--a2ui-loading-color, light-dark(var(--p-20), var(--n-100)));
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }
        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  #renderVideo() {
    const videoUrl = extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    if (!videoUrl) {
      return nothing;
    }

    return html`${!this.#loaded
        ? html`<div class="loading-message">
            <span class="g-icon round rotate">progress_activity</span>
            Loading video…
          </div>`
        : nothing}
      <video
        class=${classMap({ loading: !this.#loaded })}
        controls
        src=${videoUrl}
        @loadedmetadata=${() => {
          this.#loaded = true;
        }}
      ></video>`;
  }

  render() {
    return html`<section>${this.#renderVideo()}</section>`;
  }
}
