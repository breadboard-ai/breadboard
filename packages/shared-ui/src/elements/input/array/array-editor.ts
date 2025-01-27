/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BehaviorSchema,
  GraphDescriptor,
  BoardServer,
} from "@google-labs/breadboard";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { LLMInput } from "../llm-input/llm-input";

enum TYPE {
  STRING = "string",
  OBJECT = "object",
  NUMBER = "number",
  BOOLEAN = "boolean",
}

type ArrayEditorType = string | number | object | boolean | null;

@customElement("bb-array-editor")
export class ArrayEditor extends LitElement {
  @property({ reflect: true })
  accessor type = TYPE.STRING;

  @property()
  accessor items: ArrayEditorType[] | null = null;

  @property({ reflect: true })
  accessor behavior: BehaviorSchema | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor graph: GraphDescriptor | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();
  #appendNewItemOnNextRender = false;

  static styles = css`
    :host {
      display: block;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      row-gap: var(--bb-grid-size);
    }

    li {
      overflow: auto;
      display: flex;
      align-items: center;
    }

    input[type="number"],
    input[type="text"],
    select,
    textarea {
      resize: none;
      display: block;
      box-sizing: border-box;
      width: 100%;
      field-sizing: content;
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-x-small);
      line-height: var(--bb-body-line-height-x-small);
      max-height: 300px;
      flex: 1;
    }

    input[type="checkbox"] {
      margin: 0;
    }

    .delete {
      width: 16px;
      height: 16px;
      background: none;
      background-image: var(--bb-icon-delete);
      background-position: center center;
      background-repeat: no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
      margin-left: var(--bb-grid-size);
    }

    .delete:hover {
      opacity: 1;
    }

    .no-items {
      color: var(--bb-neutral-500);
      line-height: calc(var(--bb-grid-size) * 5);
    }

    #add-new-item {
      width: 16px;
      height: 16px;
      background: var(--bb-icon-add-circle) center center no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    #add-new-item:hover {
      opacity: 1;
    }

    #unset-all-items,
    #create {
      font-size: var(--bb-label-small);
      background: var(--bb-ui-500);
      color: #246db5;
      border-radius: 20px;
      border: none;
      height: calc(var(--bb-grid-size) * 4);
      padding: 0 calc(var(--bb-grid-size) * 2);
      margin: 0 0 0 var(--bb-grid-size);
    }
  `;

  get value() {
    return JSON.stringify(this.items);
  }

  #addItem() {
    if (!this.items) {
      this.items = [];
    }

    this.#appendNewItemOnNextRender = true;
    if (!this.#updateItems()) {
      return;
    }

    this.requestUpdate();
  }

  #removeItem(evt: Event) {
    if (
      !(evt.target instanceof HTMLButtonElement) ||
      !this.items ||
      !this.#formRef.value
    ) {
      return;
    }

    if (!confirm("Are you sure you want to remove this item?")) {
      return;
    }

    const idxAsStr = evt.target.dataset.idx;
    if (!idxAsStr) {
      return;
    }

    const idx = parseInt(idxAsStr, 10);
    if (Number.isNaN(idx)) {
      return;
    }

    this.items.splice(idx, 1);
    this.#notify();
    this.requestUpdate();
  }

  #unsetAll() {
    if (!confirm("Are you sure you want to unset all items in this array?")) {
      return;
    }

    this.items = null;
    this.#notify();
    this.requestUpdate();
  }

  #updateItems() {
    if (!this.#formRef.value) {
      return true;
    }

    const form = this.#formRef.value;
    const items: ArrayEditorType[] = [];

    for (const entry of form.querySelectorAll<HTMLInputElement>(".entry")) {
      if ("setCustomValidity" in entry) {
        entry.setCustomValidity("");
      }

      switch (this.type) {
        case TYPE.STRING: {
          items.push(entry.value);
          break;
        }

        case TYPE.NUMBER: {
          items.push(
            Number.isNaN(entry.valueAsNumber) ? null : entry.valueAsNumber
          );
          break;
        }

        case TYPE.BOOLEAN: {
          items.push(entry.checked);
          break;
        }

        case TYPE.OBJECT: {
          if (this.behavior === "llm-content") {
            (entry as unknown as LLMInput).processAllOpenParts();
            items.push(entry.value);
            break;
          }

          if (this.behavior === "board") {
            items.push(entry.value);
            break;
          }

          try {
            items.push(JSON.parse(entry.value));
          } catch (err) {
            console.warn("Unable to parse", entry.value);
            console.warn(err);
          }
          break;
        }
      }
    }

    this.items = items;
  }

  #notify() {
    // Report up to the container that there's been successful input.
    this.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true })
    );
  }

  protected willUpdate(): void {
    if (!this.#appendNewItemOnNextRender || !this.items) {
      return;
    }

    const items = [...this.items];
    switch (this.type) {
      case TYPE.STRING:
      case TYPE.NUMBER: {
        items.push("");
        break;
      }

      case TYPE.BOOLEAN: {
        items.push(false);
        break;
      }

      case TYPE.OBJECT: {
        if (this.behavior === "board") {
          items.push(null);
          break;
        } else if (this.behavior === "llm-content") {
          items.push({
            role: "user",
            parts: [],
          });
          break;
        }

        items.push({});
        break;
      }
    }

    this.items = items;
  }

  protected updated(): void {
    if (!this.#appendNewItemOnNextRender || !this.#formRef.value) {
      return;
    }

    this.#appendNewItemOnNextRender = false;

    const inputs = this.#formRef.value.querySelectorAll("textarea");
    if (inputs.length === 0) {
      return;
    }
    inputs[inputs.length - 1].focus();
  }

  render() {
    if (!this.items) {
      return html`(Not set)
        <button
          id="create"
          @click=${(evt: Event) => {
            evt.preventDefault();
            evt.stopImmediatePropagation();
            this.#addItem();
          }}
        >
          Create array
        </button>`;
    }

    return html`<form
      ${ref(this.#formRef)}
      @input=${(evt: Event) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();

        if (
          evt.target instanceof HTMLInputElement ||
          evt.target instanceof HTMLTextAreaElement
        ) {
          evt.target.setCustomValidity("");
        }

        this.#updateItems();
        this.#notify();
      }}
      @blur=${(evt: InputEvent) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        this.#updateItems();
        this.#notify();
      }}
      @submit=${(evt: Event) => evt.preventDefault()}
    >
      <ul>
        ${this.items.length
          ? map(this.items, (item, idx) => {
              let selector: HTMLTemplateResult | symbol = nothing;
              switch (this.type) {
                case TYPE.STRING: {
                  selector = html`<textarea
                    name="item-${idx}"
                    id="item-${idx}"
                    class="entry"
                    .value=${item}
                  ></textarea>`;
                  break;
                }

                case TYPE.NUMBER: {
                  selector = html`<input
                    name="item-${idx}"
                    id="item-${idx}"
                    type="number"
                    class="entry"
                    .value=${item}
                  />`;
                  break;
                }

                case TYPE.BOOLEAN: {
                  selector = html`<input
                    type="checkbox"
                    name="item-${idx}"
                    id="item-${idx}"
                    class="entry"
                    ?checked=${item}
                  />`;
                  break;
                }

                case TYPE.OBJECT: {
                  if (this.behavior === "board") {
                    selector = html`<bb-board-selector
                      name="item-${idx}"
                      id="item-${idx}"
                      class="entry"
                      .graph=${this.graph}
                      .subGraphs=${this.graph?.graphs ?? null}
                      .boardServers=${this.boardServers}
                      .value=${item ?? ""}
                    ></bb-board-selector>`;
                    break;
                  } else if (this.behavior === "llm-content") {
                    // const value = JSON.stringify(item, null, 2);
                    selector = html`<bb-llm-input
                      name="item-${idx}"
                      id="item-${idx}"
                      class="entry"
                      .value=${item ?? null}
                    ></bb-llm-input>`;
                    break;
                  }

                  selector = html`<textarea
                    name="item-${idx}"
                    id="item-${idx}"
                    class="entry"
                    .value=${JSON.stringify(item, null, 2) ?? null}
                    @input=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLTextAreaElement)) {
                        return;
                      }
                      // We only want to attempt to parse the value when the
                      // user leaves the field.
                      evt.stopImmediatePropagation();
                      evt.target.setCustomValidity("");
                    }}
                    @blur=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLTextAreaElement)) {
                        return;
                      }

                      try {
                        JSON.parse(evt.target.value);
                        if (!this.#formRef.value) {
                          return;
                        }
                        this.#formRef.value.dispatchEvent(
                          new InputEvent("input")
                        );
                      } catch (err) {
                        // When there is a JSON parse error in an object prevent
                        // the input from propagating further up.
                        evt.target.setCustomValidity(
                          "Please enter a valid object"
                        );
                        evt.target.reportValidity();
                      }
                    }}
                  ></textarea>`;
                  break;
                }

                default: {
                  console.warn(`Unexpected type for array: ${this.type}`);
                  return nothing;
                }
              }

              return html`<li>
                ${selector}
                <button
                  class="delete"
                  id="del-${idx}"
                  data-idx=${idx}
                  @click=${this.#removeItem}
                  title="Delete this item"
                  type="button"
                >
                  Delete this item
                </button>
              </li> `;
            })
          : html`<li class="no-items">(No items)</li>`}
        <li>
          <button
            id="add-new-item"
            title="Add new item"
            type="button"
            @click=${this.#addItem}
          >
            Add new item
          </button>
          <button
            id="unset-all-items"
            title="Unset all items"
            type="button"
            @click=${this.#unsetAll}
          >
            Unset all items
          </button>
        </li>
      </ul>
    </form>`;
  }
}
