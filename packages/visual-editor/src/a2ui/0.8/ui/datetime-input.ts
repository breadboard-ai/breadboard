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
import { StringValue } from "../types/primitives.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { extractStringValue } from "./utils/utils.js";

/**
 * Date/time input component with two-way data binding.
 *
 * Supports date-only, time-only, or combined datetime-local input modes.
 * Resolves its value from a `StringValue` and writes changes back via
 * `processor.setData()`.
 */
@customElement("a2ui-datetimeinput")
export class DateTimeInput extends Root {
  @property()
  accessor value: StringValue | null = null;

  @property()
  accessor label: StringValue | null = null;

  @property({ reflect: false, type: Boolean })
  accessor enableDate = true;

  @property({ reflect: false, type: Boolean })
  accessor enableTime = true;

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: hidden;
      }

      input {
        display: block;
        width: 100%;
        padding: var(--a2ui-spacing-2) var(--a2ui-spacing-3);
        border-radius: var(--a2ui-input-radius, var(--a2ui-border-radius-full));
        border: var(--a2ui-border-width) solid var(--a2ui-color-border);
        font-family: var(--a2ui-font-family);
        color: var(--a2ui-color-on-surface);
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

  #renderField(value: string) {
    return html`<section>
      <label for="data">${this.#getPlaceholderText()}</label>
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
        .value=${this.#formatInputValue(value)}
        .placeholder=${this.#getPlaceholderText()}
        .type=${this.#getInputType()}
      />
    </section>`;
  }

  #getInputType() {
    if (this.enableDate && this.enableTime) {
      return "datetime-local";
    } else if (this.enableDate) {
      return "date";
    } else if (this.enableTime) {
      return "time";
    }

    return "datetime-local";
  }

  #formatInputValue(value: string) {
    const inputType = this.#getInputType();
    const date = value ? new Date(value) : null;

    if (!date || isNaN(date.getTime())) {
      return "";
    }

    const year = this.#padNumber(date.getFullYear());
    const month = this.#padNumber(date.getMonth());
    const day = this.#padNumber(date.getDate());
    const hours = this.#padNumber(date.getHours());
    const minutes = this.#padNumber(date.getMinutes());

    // Browsers are picky with what format they allow for the `value` attribute of date/time inputs.
    // We need to parse it out of the provided value. Note that we don't use `toISOString`,
    // because the resulting value is relative to UTC.
    if (inputType === "date") {
      return `${year}-${month}-${day}`;
    } else if (inputType === "time") {
      return `${hours}:${minutes}`;
    }

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  #padNumber(value: number) {
    return value.toString().padStart(2, "0");
  }

  #getPlaceholderText() {
    // TODO: this should likely be passed from the model.
    const inputType = this.#getInputType();

    if (inputType === "date") {
      return "Date";
    } else if (inputType === "time") {
      return "Time";
    }

    return "Date & Time";
  }

  render() {
    const value = extractStringValue(
      this.value,
      this.component,
      this.processor,
      this.surfaceId
    );

    return this.#renderField(value);
  }
}
