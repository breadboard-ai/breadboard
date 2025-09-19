/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { until } from "lit/directives/until.js";
import { StringValue } from "../types/component-update";

@customElement("gulf-datetimeinput")
export class DateTimeInput extends Root {
  @property()
  accessor value: StringValue | null = null;

  @property()
  accessor label: StringValue | null = null;

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
    if (!this.value || !this.model) {
      return;
    }

    if (!("path" in this.value)) {
      return;
    }

    if (!this.value.path) {
      return;
    }

    this.model.setDataProperty(this.value.path, this.dataPrefix, value);
  }

  #renderField(value: string | number) {
    return html`<div class="description">
        ${this.label?.literalString ?? "Date & Time"}
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
          type="datetime-local"
        />
      </div>`;
  }

  render() {
    if (this.value && typeof this.value === "object") {
      if ("literalString" in this.value && this.value.literalString) {
        return this.#renderField(this.value.literalString);
      } else if (this.value && "path" in this.value && this.value.path) {
        if (!this.model) {
          return html`(no model)`;
        }

        const textValue = this.model
          ?.getDataProperty(this.value.path, this.dataPrefix)
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
