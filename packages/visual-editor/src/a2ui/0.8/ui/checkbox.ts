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
import { StringValue, BooleanValue } from "../types/primitives.js";
import { A2UIModelProcessor } from "../data/model-processor.js";

@customElement("a2ui-checkbox")
export class Checkbox extends Root {
  @property()
  accessor value: BooleanValue | null = null;

  @property()
  accessor label: StringValue | null = null;

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
      }

      section {
        display: inline-flex;
        align-items: center;
      }

      input[type="checkbox"] {
        margin: 0;
        margin-right: var(--a2ui-spacing-2);
        padding: var(--a2ui-spacing-2);
        border-radius: var(--a2ui-border-radius-full);
        border: var(--a2ui-border-width) solid var(--a2ui-color-border);
      }

      label {
        font-family: var(--a2ui-font-family-flex);
        font-variation-settings: "ROND" 100;
        font-weight: 400;
        flex: 1;
        font-size: 14px;
        line-height: 20px;
      }
    `,
  ];

  #setBoundValue(checked: boolean) {
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
      checked,
      this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
    );
  }

  #renderField(value: boolean | number) {
    return html` <section>
      <input
        autocomplete="off"
        @change=${(evt: Event) => {
          if (!(evt.target instanceof HTMLInputElement)) {
            return;
          }

          this.#setBoundValue(evt.target.checked);
        }}
        id="data"
        type="checkbox"
        .checked=${value}
      />
      <label for="data">${this.label?.literalString}</label>
    </section>`;
  }

  render() {
    if (this.value && typeof this.value === "object") {
      if ("literalBoolean" in this.value && this.value.literalBoolean) {
        return this.#renderField(this.value.literalBoolean);
      } else if ("literal" in this.value && this.value.literal !== undefined) {
        return this.#renderField(this.value.literal);
      } else if (this.value && "path" in this.value && this.value.path) {
        if (!this.processor || !this.component) {
          return html`(no model)`;
        }

        const textValue = this.processor.getData(
          this.component,
          this.value.path,
          this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
        );

        if (typeof textValue === "boolean") {
          return this.#renderField(textValue);
        }

        if (textValue === null) {
          return html`Invalid label`;
        }

        if (textValue !== "true" && textValue !== "false") {
          return html`Invalid label`;
        }

        return this.#renderField(textValue === "true");
      }
    }

    return nothing;
  }
}
