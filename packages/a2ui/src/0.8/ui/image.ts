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
import { classMap } from "lit/directives/class-map.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { styleMap } from "lit/directives/style-map.js";
import { structuralStyles } from "./styles.js";

@customElement("a2ui-image")
export class Image extends Root {
  @property()
  accessor url: StringValue | null = null;

  static styles = [
    structuralStyles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
      }

      img {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  #renderImage() {
    if (!this.url) {
      return nothing;
    }

    const render = (url: string) => {
      return html`<img src=${url} />`;
    };

    if (this.url && typeof this.url === "object") {
      if ("literalString" in this.url) {
        const imageUrl = this.url.literalString ?? "";
        return render(imageUrl);
      } else if ("literal" in this.url) {
        const imageUrl = this.url.literal ?? "";
        return render(imageUrl);
      } else if (this.url && "path" in this.url && this.url.path) {
        if (!this.processor || !this.component) {
          return html`(no model)`;
        }

        const imageUrl = this.processor.getData(
          this.component,
          this.url.path,
          this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
        );
        if (!imageUrl) {
          return html`Invalid image URL`;
        }

        if (typeof imageUrl !== "string") {
          return html`Invalid image URL`;
        }
        return render(imageUrl);
      }
    }

    return html`(empty)`;
  }

  render() {
    return html`<section
      class=${classMap(this.theme.components.Image)}
      style=${this.theme.additionalStyles?.Image
        ? styleMap(this.theme.additionalStyles?.Image)
        : nothing}
    >
      ${this.#renderImage()}
    </section>`;
  }
}
