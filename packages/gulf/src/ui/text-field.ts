/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { Root } from "./root";
import { setData } from "../utils/utils";

@customElement("gulf-textfield")
export class TextField extends Root {
  @property()
  accessor description: string | null = null;

  @property()
  accessor inputType: "shortText" | "number" | null = null;

  @query("input")
  accessor #input: HTMLInputElement | null = null;

  static styles = css`
    :host {
      display: block;
    }

    input {
      display: block;
      border-radius: 8px;
      padding: 8px;
      border: 1px solid #ccc;
    }

    .description {
      font-size: 14px;
      margin-bottom: 4px;
    }
  `;

  get value() {
    return this.#input?.value ?? null;
  }

  #setBoundValue(value: string) {
    if (!this.valueBinding) {
      return;
    }

    setData(this.data, this.valueBinding, value);
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    const shouldUpdate = changedProperties.has("valueBinding");
    // TODO: Default values.
    if (shouldUpdate) {
      this.#setBoundValue("");
    }
  }

  render() {
    return html`<div class="description">${this.description}</div>
      <div>
        <input
          @change=${(evt: Event) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.#setBoundValue(evt.target.value);
          }}
          id="data"
          type=${this.inputType === "number" ? "number" : "text"}
        />
      </div>`;
  }
}
