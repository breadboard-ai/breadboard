/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, css, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import * as StringsHelper from "../../strings/helper.js";
import { icons } from "../../styles/icons.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";

const Strings = StringsHelper.forSection("ProjectListing");

@customElement("bb-homepage-search-button")
export class HomepageSearchButton extends LitElement {
  static styles = [
    icons,
    colorsLight,
    type,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        height: var(--bb-grid-size-7);
      }

      button {
        background: none;
        border: none;
        display: flex;
        cursor: pointer;
        align-items: center;
        height: 100%;

        & > .g-icon {
          margin-right: 4px;
        }
      }

      input {
        border: 1px solid var(--n-70);
        background: var(--n-98);
        height: 100%;
        border-radius: var(--bb-grid-size-16);
        padding: 0 32px 0 var(--bb-grid-size-4);
        width: 200px;
        outline: none;
        font-size: 12px;
      }

      #label {
        font-size: 12px;
        color: var(--n-35);
      }

      #search-icon {
        margin-left: -32px;
      }
    `,
  ];

  @property()
  accessor value = "";

  @state()
  accessor #forceOpen = false;

  #input = createRef<HTMLInputElement>();

  override render() {
    if (this.value || this.#forceOpen) {
      return html`
        <input
          ${ref(this.#input)}
          type="search"
          autocomplete="off"
          .placeholder=${Strings.from("LABEL_SEARCH_BOARDS")}
          .value=${this.value}
          @focus=${this.#onInputFocus}
          @input=${this.#onInputInput}
          @blur=${this.#onInputBlur}
          class="sans-flex round w-500"
        />
        <span class="g-icon filled round w-500" id="search-icon">search</span>
      `;
    } else {
      return html`
        <button @click=${this.#onButtonClick}>
          <span class="g-icon filled round w-500">search</span>
          <span id="label" class="sans-flex round w-500">Search</span>
        </button>
      `;
    }
  }

  async focus() {
    await this.updateComplete;
    this.#input.value?.focus();
  }

  async #onButtonClick() {
    this.#forceOpen = true;
    this.focus();
  }

  #onInputInput() {
    this.value = this.#input.value?.value ?? "";
  }

  #onInputFocus() {
    this.#forceOpen = true;
  }

  #onInputBlur() {
    this.#forceOpen = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-homepage-search-button": HomepageSearchButton;
  }
}
