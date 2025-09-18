/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { Root } from "./root";

@customElement("gulf-multiplechoice")
export class MultipleChoice extends Root {
  @property()
  accessor description: string | null = null;

  @property()
  accessor options: { label: string; value: string }[] = [];

  @query("select")
  accessor #select: HTMLSelectElement | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      flex: var(--weight);
      font: var(--font-family);
    }

    select {
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

  #setBoundValue(_value: string[]) {
    // if (!this.value || !this.data) {
    //   return;
    // }
    // if (!("path" in this.value)) {
    //   return;
    // }
    // setData(this.data, this.value.path, value);
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    const shouldUpdate =
      changedProperties.has("value") ||
      changedProperties.has("options") ||
      changedProperties.has("model");
    if (shouldUpdate) {
      this.#setBoundValue([this.options[0].value]);
    }
  }

  render() {
    return html` <div class="description">
        ${this.description ?? "Select an item"}
      </div>
      <select
        @change=${(evt: Event) => {
          if (!this.value) {
            return;
          }

          if (!(evt.target instanceof HTMLSelectElement)) {
            return;
          }

          this.#setBoundValue([evt.target.value]);
        }}
      >
        ${this.options.map(
          (option) => html`<option ${option.value}>${option.label}</option>`
        )}
      </select>`;
  }
}
