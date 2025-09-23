/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import {
  StringValue,
  TextField as TextFieldDefinition,
} from "../types/component-update";
import { until } from "lit/directives/until.js";

@customElement("gulf-textfield")
export class TextField extends Root {
  @property()
  accessor text: StringValue | null = null;

  @property()
  accessor label: StringValue | null = null;

  @property()
  accessor inputType: TextFieldDefinition["type"] | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      flex: var(--weight);
    }

    input {
      display: block;
      border-radius: 8px;
      padding: 8px;
      border: 1px solid #ccc;
      width: 100%;
    }

    .description {
      font-size: 14px;
      margin-bottom: 4px;
    }
  `;

  #setBoundValue(value: string) {
    if (!this.text || !this.model) {
      return;
    }

    if (!("path" in this.text)) {
      return;
    }

    if (!this.text.path) {
      return;
    }

    this.model.setDataProperty(this.text.path, this.dataPrefix, value);
  }

  #renderField(value: string | number) {
    return html`<div class="description">
        ${this.label?.literalString ?? ""}
      </div>
      <div>
        <input
          autocomplete="off"
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.#setBoundValue(evt.target.value);
          }}
          id="data"
          .value=${value}
          type=${this.inputType === "number" ? "number" : "text"}
        />
      </div>`;
  }

  render() {
    if (this.text && typeof this.text === "object") {
      if ("literalString" in this.text && this.text.literalString) {
        return this.#renderField(this.text.literalString);
      } else if (this.text && "path" in this.text && this.text.path) {
        if (!this.model) {
          return html`(no model)`;
        }

        const textValue = this.model
          ?.getDataProperty(this.text.path, this.dataPrefix)
          .then((data) => {
            if (typeof data !== "string" && typeof data !== "number") {
              return html`(invalid)`;
            }
            return this.#renderField(data);
          });
        return html`${until(textValue)}`;
      }
    }

    return nothing;
  }
}
