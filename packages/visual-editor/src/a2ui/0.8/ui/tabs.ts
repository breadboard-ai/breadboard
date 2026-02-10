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

import { html, css, PropertyValues, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { repeat } from "lit/directives/repeat.js";
import { StringValue } from "../types/primitives.js";
import { A2UIModelProcessor } from "../data/model-processor.js";

@customElement("a2ui-tabs")
export class Tabs extends Root {
  @property()
  accessor titles: StringValue[] | null = null;

  @property()
  accessor selected = 0;

  static styles = [
    css`
      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
      }

      section {
        display: flex;
        flex-direction: column;
        gap: var(--a2ui-spacing-2);
      }

      #buttons {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: var(--a2ui-spacing-4);
      }

      #buttons button {
        font-family: var(--a2ui-font-family-flex);
        font-variation-settings: "ROND" 100;
        font-weight: 400;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 14px;
        line-height: 20px;
        padding: 0;
        transition: opacity var(--a2ui-transition-speed) ease;
      }

      #buttons button:hover {
        opacity: 0.8;
      }

      #buttons button:disabled {
        opacity: 1;
        font-weight: 500;
        cursor: default;
      }
    `,
  ];

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("selected")) {
      for (const child of this.children) {
        child.removeAttribute("slot");
      }
      const selectedChild = this.children[this.selected];
      if (!selectedChild) {
        return;
      }

      selectedChild.slot = "current";
    }
  }

  #renderTabs() {
    if (!this.titles) {
      return nothing;
    }

    return html`<div id="buttons">
      ${repeat(this.titles, (title, idx) => {
        let titleString = "";
        if ("literalString" in title && title.literalString) {
          titleString = title.literalString;
        } else if ("literal" in title && title.literal !== undefined) {
          titleString = title.literal;
        } else if (title && "path" in title && title.path) {
          if (!this.processor || !this.component) {
            return html`(no model)`;
          }

          const textValue = this.processor.getData(
            this.component,
            title.path,
            this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
          );

          if (typeof textValue !== "string") {
            return html`(invalid)`;
          }

          titleString = textValue;
        }

        return html`<button
          ?disabled=${this.selected === idx}
          @click=${() => {
            this.selected = idx;
          }}
        >
          ${titleString}
        </button>`;
      })}
    </div>`;
  }

  #renderSlot() {
    return html`<div><slot name="current"></slot></div>`;
  }

  render() {
    return html`<section>${[this.#renderTabs(), this.#renderSlot()]}</section>`;
  }
}
