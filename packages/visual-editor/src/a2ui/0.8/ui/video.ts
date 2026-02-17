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

import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { extractStringValue } from "./utils/utils.js";

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

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
        padding: var(--a2ui-video-padding, 0);
      }

      video {
        display: block;
        width: 100%;
        border-radius: var(--a2ui-video-radius, 20px);
        object-fit: cover;
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

    return html`<video controls src=${videoUrl} />`;
  }

  render() {
    return html`<section>${this.#renderVideo()}</section>`;
  }
}
