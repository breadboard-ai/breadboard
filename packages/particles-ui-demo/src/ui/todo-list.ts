/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TodoItems } from "../types/types.js";
import { SignalWatcher } from "@lit-labs/signals";
import { repeat } from "lit/directives/repeat.js";

import "./todo-item.js";

@customElement("todo-list")
export class TodoListView extends SignalWatcher(LitElement) {
  @property()
  accessor items: TodoItems | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  #renderCreateButton() {
    return html`<button
      @click=${() => {
        // TODO.
      }}
    >
      Create new
    </button>`;
  }

  render() {
    if (!this.items || this.items.size === 0) {
      return this.#renderCreateButton();
    }

    return html`${repeat(this.items, (item) => {
      return html`<todo-item .item=${item}></todo-item>`;
    })}`;
  }
}
