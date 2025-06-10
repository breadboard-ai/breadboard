/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TodoItem } from "../types/types.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("todo-item")
export class TodoItemView extends LitElement {
  @property()
  accessor todo: TodoItem | null = null;

  static styles = css`
    :host {
      display: block;
    }

    section {
      display: grid;
      grid-template-columns: 1fr 20px;
      column-gap: 20px;
    }
  `;

  render() {
    if (!this.todo) {
      return nothing;
    }

    return html`<div>
      <section>
        ${this.todo.done ? html`<s></s>` : nothing}
        <h1 class=${classMap({ done: this.todo.done })}>${this.todo.title}</h1>
        ${this.todo.description
          ? html`<h2>${this.todo.description}</h2>`
          : nothing}
        ${this.todo.description ? html`<p>${this.todo.dueDate}</p>` : nothing}
        ${this.todo.done ? html`</s>` : nothing}
      </section>
      <button
        @click=${() => {
          // TODO.
        }}
      >
        Del
      </button>
    </div>`;
  }
}
