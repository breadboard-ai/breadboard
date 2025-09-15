/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { Root } from "./root";
import { setData } from "../utils/utils";

@customElement("gulf-multiplechoice")
export class MultipleChoice extends Root {
  @property()
  accessor options: string[] = [];

  @query("select")
  accessor #select: HTMLSelectElement | null = null;

  static styles = css`
    :host {
      display: block;
    }

    select {
      border-radius: 8px;
      padding: 8px;
      border: 1px solid #ccc;
    }
  `;

  get value() {
    return this.#select?.value ?? null;
  }

  #setBoundValue(value: Array<string>) {
    if (!this.valueBinding || !this.options.length) {
      return;
    }

    setData(this.data, this.valueBinding, value);
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    const shouldUpdate =
      changedProperties.has("valueBinding") || changedProperties.has("options");
    if (shouldUpdate) {
      this.#setBoundValue([this.options[0]]);
    }
  }

  render() {
    return html`<select
      @change=${(evt: Event) => {
        if (!this.valueBinding) {
          return;
        }

        if (!(evt.target instanceof HTMLSelectElement)) {
          return;
        }

        this.#setBoundValue([evt.target.value]);
      }}
    >
      ${this.options.map((option) => html`<option>${option}</option>`)}
    </select>`;
  }
}
