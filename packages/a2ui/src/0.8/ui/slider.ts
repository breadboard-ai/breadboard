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
import { NumberValue, StringValue } from "../types/primitives";
import { ResolvedTextField } from "../types/types.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { structuralStyles } from "./styles.js";

@customElement("a2ui-slider")
export class Slider extends Root {
  @property()
  accessor value: NumberValue | null = null;

  @property()
  accessor minValue = 0;

  @property()
  accessor maxValue = 0;

  @property()
  accessor label: StringValue | null = null;

  @property()
  accessor inputType: ResolvedTextField["type"] | null = null;

  static styles = [
    structuralStyles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
      }

      input {
        display: block;
        width: 100%;
      }

      .description {
      }
    `,
  ];

  #setBoundValue(value: string) {
    if (!this.value || !this.processor) {
      return;
    }

    if (!("path" in this.value)) {
      return;
    }

    if (!this.value.path) {
      return;
    }

    this.processor.setData(
      this.component,
      this.value.path,
      value,
      this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
    );
  }

  #renderField(value: string | number) {
    return html`<div class="description">
        ${this.label?.literalString ?? ""}
      </div>
      <div>
        <input
          autocomplete="off"
          class=${classMap(this.theme.components.Slider)}
          style=${this.theme.additionalStyles?.Slider
            ? styleMap(this.theme.additionalStyles?.Slider)
            : nothing}
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.#setBoundValue(evt.target.value);
          }}
          id="data"
          .value=${value}
          type="range"
          min=${this.minValue ?? "0"}
          max=${this.maxValue ?? "0"}
        />
      </div>`;
  }

  render() {
    if (this.value && typeof this.value === "object") {
      if ("literalNumber" in this.value && this.value.literalNumber) {
        return this.#renderField(this.value.literalNumber);
      } else if ("literal" in this.value && this.value.literal !== undefined) {
        return this.#renderField(this.value.literal);
      } else if (this.value && "path" in this.value && this.value.path) {
        if (!this.processor || !this.component) {
          return html`(no processor)`;
        }

        const textValue = this.processor.getData(
          this.component,
          this.value.path,
          this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
        );

        if (textValue === null) {
          return html`Invalid value`;
        }

        if (typeof textValue !== "string") {
          return html`Invalid value`;
        }

        return this.#renderField(textValue);
      }
    }

    return nothing;
  }
}
