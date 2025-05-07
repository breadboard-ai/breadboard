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

const Strings = StringsHelper.forSection("ProjectListing");

@customElement("bb-homepage-search-button")
export class HomepageSearchButton extends LitElement {
  static styles = [
    icons,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        height: 30px;
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
        border: 1px solid currentColor;
        height: 100%;
        border-radius: 100px;
        padding: 10px 32px 10px 16px;
        width: 230px;
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
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
        />
        <span class="g-icon" id="search-icon">search</span>
      `;
    } else {
      return html`
        <button @click=${this.#onButtonClick}>
          <span class="g-icon">search</span>
          Search
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
