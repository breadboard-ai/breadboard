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

import { html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { extractStringValue } from "./utils/utils.js";

@customElement("a2ui-multiplechoice")
export class MultipleChoice extends Root {
  @property()
  accessor description: string | null = null;

  @property()
  accessor options: { label: StringValue; value: string }[] = [];

  @property()
  accessor selections: StringValue | string[] = [];

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
        display: flex;
        flex-direction: row;
        gap: var(--a2ui-spacing-2);
        padding: var(--a2ui-spacing-4);
        border-radius: var(--a2ui-border-radius);
        margin: var(--a2ui-spacing-2) 0;
        border: var(--a2ui-border-width) solid var(--a2ui-color-border);
      }

      label {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex: 0 0 auto;
        font-family: var(--a2ui-font-family);
        font-style: normal;
        font-weight: 400;
        margin: 0;
        font-size: 14px;
        line-height: 20px;
        align-self: normal;
      }

      select {
        width: 100%;
        padding: var(--a2ui-spacing-2);
        border-radius: var(--a2ui-border-radius);
        margin: var(--a2ui-spacing-2) 0;
        border: var(--a2ui-border-width) solid var(--a2ui-color-border);
      }
    `,
  ];

  #setBoundValue(value: string[]) {
    console.log(value);
    if (!this.selections || !this.processor) {
      return;
    }
    if (!("path" in this.selections)) {
      return;
    }
    if (!this.selections.path) {
      return;
    }

    this.processor.setData(
      this.component,
      this.selections.path,
      value,
      this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
    );
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    const shouldUpdate = changedProperties.has("options");
    if (!shouldUpdate) {
      return;
    }

    if (!this.processor || !this.component || Array.isArray(this.selections)) {
      return;
    }

    const selectionValue = this.processor.getData(
      this.component,
      this.selections.path!,
      this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
    );

    if (!Array.isArray(selectionValue)) {
      return;
    }

    this.#setBoundValue(selectionValue as string[]);
  }

  render() {
    return html`<section>
      <label for="data">${this.description ?? "Select an item"}</label>
      <select
        name="data"
        id="data"
        @change=${(evt: Event) => {
          if (!(evt.target instanceof HTMLSelectElement)) {
            return;
          }

          this.#setBoundValue([evt.target.value]);
        }}
      >
        ${this.options.map((option) => {
          const label = extractStringValue(
            option.label,
            this.component,
            this.processor,
            this.surfaceId
          );
          return html`<option ${option.value}>${label}</option>`;
        })}
      </select>
    </section>`;
  }
}
