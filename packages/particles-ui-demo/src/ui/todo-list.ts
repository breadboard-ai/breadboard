/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TodoItem, TodoItems } from "../types/types.js";
import { SignalWatcher, html } from "@lit-labs/signals";
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
    return html`<button
      @click=${() => {
        this.items?.set(globalThis.crypto.randomUUID(), {
          title: "",
          done: false,
        });
      }}
    >
      Create new
    </button>`;
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
      html`${repeat(this.items, ([id, item]) => {
        return html`<todo-item
          @input=${(evt: Event) => {
            const target = evt
              .composedPath()
              .find((el) => el instanceof HTMLElement && el.dataset.behavior);
            if (!(target instanceof HTMLInputElement)) {
              return;
            }

            switch (target.dataset.behavior) {
              case "editable": {
                const item = this.items?.get(id);
                const field = target.id as keyof TodoItem;
                if (!item) {
                  return;
                }

                Reflect.set(item, field, target.value);
                return;
              }
            }
          }}
          @click=${(evt: Event) => {
            const target = evt
              .composedPath()
              .find((el) => el instanceof HTMLElement && el.dataset.behavior);
            if (!(target instanceof HTMLElement)) {
              return;
            }

            switch (target.dataset.behavior) {
              case "delete": {
                this.items?.delete(id);
                return;
              }

              case "done": {
                const item = this.items?.get(id);
                if (!item) {
                  return;
                }
                item.done = !item.done;
              }
            }
          }}
          .item=${item}
        ></todo-item>`;
      })}`,
    ];
  }
}
