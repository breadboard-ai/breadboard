/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Channel, TodoItems } from "../types/types.js";
import { SignalWatcher, html } from "@lit-labs/signals";
import { repeat } from "lit/directives/repeat.js";

import "./todo-item.js";

@customElement("todo-list")
export class TodoListView extends SignalWatcher(LitElement) {
  @property()
  accessor items: TodoItems | null = null;

  @property()
  accessor channel: Channel | null = null;

  static styles = css`
    :host {
      display: block;
    }

    button {
      border-radius: 100px;
      height: 32px;
      border: none;
      padding: 0 12px;
      cursor: pointer;
      margin-bottom: 12px;
    }

    todo-item {
      margin-bottom: 24px;
    }
  `;

  #renderCreateButton() {
    return html`<button data-behavior="add">Create new</button>`;
  }

  #renderHeader() {
    const size = this.items?.size ?? 0;

    return [
      html`<h1>Todo List</h1>`,
      html`<h2>${size} item${size === 1 ? "" : "s"}</h2>`,
      this.#renderCreateButton(),
    ];
  }

  render() {
    if (!this.items || this.items.size === 0) {
      return this.#renderHeader();
    }

    return [
      this.#renderHeader(),
      html`${repeat(
        this.items,
        (id) => id,
        ([id, item]) => {
          return html`<todo-item data-id=${id} .item=${item}></todo-item>`;
        }
      )}`,
    ];
  }
}
