/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BehaviorSchema,
  GraphDescriptor,
  GraphProvider,
} from "@google-labs/breadboard";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { assertIsLLMContent } from "../../utils/schema.js";
import { BoardSelector } from "./board-selector.js";

enum TYPE {
  STRING = "string",
  OBJECT = "object",
  NUMBER = "number",
}

type ArrayEditorType = string | number | object;

@customElement("bb-array-editor")
export class ArrayEditor extends LitElement {
  @property({ reflect: true })
  type = TYPE.STRING;

  @property({ reflect: true })
  behavior: BehaviorSchema | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  @property()
  graph: GraphDescriptor | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();
  #items: ArrayEditorType[] | null = null;
  #appendNewItemOnNextRender = false;

  static styles = css`
    :host {
      display: block;
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
      background: var(--bb-continue-color);
      color: #246db5;
      border-radius: 20px;
      border: none;
      height: calc(var(--bb-grid-size) * 4);
      padding: 0 calc(var(--bb-grid-size) * 2);
      margin: 0 0 0 var(--bb-grid-size);
    }
  `;

  set items(items: ArrayEditorType[] | null) {
    this.#items = items;

    if (items && items.length > 0) {
      const type = typeof items[0];
      switch (type) {
        case "string":
          this.type = TYPE.STRING;
          break;

        case "number":
          this.type = TYPE.NUMBER;
          break;

        case "object":
          this.type = TYPE.OBJECT;
          break;

        default:
          console.warn(`Array editor sent unexpected data: ${type}`);
          break;
      }
    }

    this.requestUpdate();
  }

  get items() {
    return this.#items;
  }

  get value() {
    return JSON.stringify(this.items);
  }

  #addItem() {
    if (!this.#items) {
      this.#items = [];
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
      !this.#items ||
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

    this.#items.splice(idx, 1);
    this.#notify();
    this.requestUpdate();
  }

  #unsetAll() {
    if (!confirm("Are you sure you want to unset all items in this array?")) {
      return;
    }

    this.#items = null;
    this.#notify();
    this.requestUpdate();
  }

  #updateItems() {
    if (!this.#formRef.value) {
      return true;
    }

    // This will update values synchronously.
    this.#formRef.value.dispatchEvent(new SubmitEvent("submit"));
    const isValid = this.#formRef.value.checkValidity();
    if (isValid) {
      this.requestUpdate();
    }
    return isValid;
  }

  #notify() {
    // Report up to the container that there's been successful input.
    this.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true })
    );
  }

  #onSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement)) {
      return;
    }

    const form = evt.target;
    const data = new FormData(form);
    const items: ArrayEditorType[] = [];

    for (const board of form.querySelectorAll<BoardSelector>(
      "bb-board-selector"
    )) {
      if (board.value === null || board.value === "") {
        continue;
      }

      data.set(board.id, board.value);
    }

    for (const [id, value] of data) {
      // Boards go through to the board selector, which will do its own
      // validation, so we don't need to do anything here besides appending.
      if (this.behavior === "board") {
        items.push(value);
        continue;
      }

      const field = form.querySelector(`#${id}`) as HTMLObjectElement;
      if (!field) {
        console.warn(`Unable to find field ${id}`);
        continue;
      }

      field.setCustomValidity("");
      const formValue = (value as string).trim();
      if (
        formValue === "" &&
        (this.type === TYPE.STRING || this.type === TYPE.NUMBER)
      ) {
        field.setCustomValidity("Field must not be empty");
        field.reportValidity();
        continue;
      }

      if (
        this.type === TYPE.NUMBER &&
        Number.isNaN(Number.parseFloat(formValue))
      ) {
        field.setCustomValidity("Field must be a number");
        field.reportValidity();
        continue;
      }

      if (this.type === TYPE.STRING || this.type === TYPE.NUMBER) {
        if (this.type === TYPE.NUMBER) {
          items.push(Number.parseFloat(value as string));
        } else {
          items.push(value);
        }
        continue;
      }

      try {
        const formValueObject = JSON.parse(formValue);
        if (this.behavior === "llm-content") {
          assertIsLLMContent(formValueObject);
        }

        if (typeof formValueObject === "string") {
          items.push(formValue);
        } else {
          items.push(formValueObject);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          field.setCustomValidity("Invalid JSON");
        } else {
          const llmError = err as Error;
          field.setCustomValidity(`Invalid LLM Content: ${llmError.message}`);
        }

        field.reportValidity();
      }
    }

    const isValid = form.checkValidity();
    if (!isValid) {
      return;
    }

    this.#items = items;
  }

  protected willUpdate(): void {
    if (!this.#appendNewItemOnNextRender || !this.#items) {
      return;
    }

    const newItem: Record<string, unknown> = {};
    if (this.behavior === "llm-content") {
      newItem.parts = [];
    }

    this.#items.push(
      this.type === TYPE.STRING ||
        this.type === TYPE.NUMBER ||
        this.behavior === "board"
        ? ""
        : newItem
    );
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
      @input=${(evt: Event) => evt.stopImmediatePropagation()}
      @submit=${this.#onSubmit}
    >
      <ul>
        ${this.items.length
          ? map(this.items, (item, idx) => {
              const value =
                typeof item === "string" ? item : JSON.stringify(item, null, 2);

              const selector =
                this.behavior === "board"
                  ? html`<bb-board-selector
                      name="item-${idx}"
                      id="item-${idx}"
                      .subGraphIds=${this.graph && this.graph.graphs
                        ? Object.keys(this.graph.graphs)
                        : []}
                      .providers=${this.providers}
                      .providerOps=${this.providerOps}
                      .value=${value || ""}
                      @input=${(evt: Event) => {
                        evt.preventDefault();
                        if (!this.#updateItems()) {
                          return;
                        }

                        this.#notify();
                      }}
                    ></bb-board-selector>`
                  : html`<textarea
                      name="item-${idx}"
                      id="item-${idx}"
                      .value=${value}
                      @input=${(evt: InputEvent) => {
                        if (!(evt.target instanceof HTMLTextAreaElement)) {
                          return;
                        }

                        const target =
                          evt.target as unknown as HTMLObjectElement;
                        target.setCustomValidity("");
                      }}
                      @blur=${() => {
                        if (!this.#updateItems()) {
                          return;
                        }

                        this.#notify();
                      }}
                    ></textarea>`;

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
