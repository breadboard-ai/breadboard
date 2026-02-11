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
import { ResolvedImage } from "../types/types.js";
import { extractStringValue } from "./utils/utils.js";

/**
 * Renders an image from a URL (literal or data-bound).
 *
 * Supports `usageHint` for semantic styling variants. The parent sets
 * `isMedia = true` in the render switch, allowing containers like Button
 * to detect image children.
 */
@customElement("a2ui-image")
export class Image extends Root {
  @property()
  accessor url: StringValue | null = null;

  @property()
  accessor usageHint: ResolvedImage["usageHint"] | null = null;

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
        padding: var(--a2ui-image-padding, 0);
      }

      section {
        border-radius: var(--a2ui-image-radius, 20px);
        width: 100%;
        height: 100%;
      }

      img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: inherit;
        object-fit: cover;
      }
    `,
  ];

  #renderImage() {
    const imageUrl = extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    if (!imageUrl) {
      return nothing;
    }

    return html`<img src=${imageUrl} />`;
  }

  render() {
    return html`<section>${this.#renderImage()}</section>`;
  }
}
