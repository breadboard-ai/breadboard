/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TodoItem } from "../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher, html } from "@lit-labs/signals";

@customElement("todo-item")
export class TodoItemView extends SignalWatcher(LitElement) {
  @property()
  accessor item: TodoItem | null = null;

  static styles = css`
    :host {
      display: block;
    }

    section {
      display: grid;
      grid-template-columns: 1fr 32px 32px;
      column-gap: 16px;
      justify-content: center;

      &.done {
        opacity: 0.4;
        > form {
          & input[type="text"],
          & input[type="date"],
          & textarea {
            border: 1px solid transparent;
            text-decoration: line-through;
          }
        }
      }

      > form {
        display: grid;
        row-gap: 8px;

        & input[type="text"],
        & input[type="date"],
        & textarea {
          font:
            400 12px / 24px "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;
          padding: 8px;
          border: 1px solid #eee;
          border-radius: 12px;

          &:focus {
            border: 1px solid #aaa;
          }
        }

        & input[type="text"] {
          font-size: 24px;
        }

        & textarea {
          resize: none;
          field-sizing: content;
        }
      }

      & button {
        width: 20px;
        height: 20px;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        font-size: 24px;

        cursor: pointer;
      }
    }
  `;

  render() {
    if (!this.item) {
      return nothing;
    }

    return html`
      <section class=${classMap({ done: this.item.done })}>
        <form>
          <input
            id="title"
            type="text"
            data-behavior="editable"
            class=${classMap({ done: this.item.done })}
            ?disabled=${this.item.done}
            .value=${this.item.title}
            .placeholder=${"Enter a value"}
          />
          <textarea
            id="description"
            data-behavior="editable"
            ?disabled=${this.item.done}
            .value=${this.item.description ?? ""}
            .placeholder=${"Enter a value (optional)"}
          ></textarea>
          <div>
            <input
              type="date"
              id="dueDate"
              data-behavior="editable"
              ?disabled=${this.item.done}
              .value=${this.item.dueDate}
            />
          </div>
        </form>
        <button data-behavior="done">✔️</button>
        <button data-behavior="delete">🗑️</button>
      </section>
    `;
  }
}
