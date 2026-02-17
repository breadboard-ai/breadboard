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

import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { NumberValue, StringValue } from "../types/primitives.js";
import { ResolvedTextField } from "../types/types.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { extractNumberValue, extractStringValue } from "./utils/utils.js";

/**
 * Range slider component with two-way data binding.
 *
 * Resolves its value from a `NumberValue` and writes changes back via
 * `processor.setData()`. Uses `extractNumberValue` for both the slider
 * position and the display readout.
 */
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
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
      }

      section {
        display: flex;
        flex-direction: row;
        gap: var(--a2ui-spacing-2);
        padding: var(--a2ui-spacing-4);
        border-radius: var(--a2ui-border-radius);
        margin: var(--a2ui-spacing-2) 0;
        border: var(--a2ui-border-width) solid var(--a2ui-color-border);
      }

      input {
        display: block;
        width: 100%;
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

  #renderField(value: number) {
    const label = extractStringValue(
      this.label,
      this.component,
      this.processor,
      this.surfaceId
    );

    return html`<section>
      <label for="data"> ${label} </label>
      <input
        autocomplete="off"
        @input=${(evt: Event) => {
          if (!(evt.target instanceof HTMLInputElement)) {
            return;
          }

          this.#setBoundValue(evt.target.value);
        }}
        id="data"
        name="data"
        .value=${value}
        type="range"
        min=${this.minValue ?? "0"}
        max=${this.maxValue ?? "0"}
      />
      <span
        >${this.value
          ? extractNumberValue(
              this.value,
              this.component,
              this.processor,
              this.surfaceId
            )
          : "0"}</span
      >
    </section>`;
  }

  render() {
    const value = extractNumberValue(
      this.value,
      this.component,
      this.processor,
      this.surfaceId
    );

    return this.#renderField(value);
  }
}
