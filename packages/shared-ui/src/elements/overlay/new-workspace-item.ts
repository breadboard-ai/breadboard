/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import {
  OverlayDismissedEvent,
  WorkspaceItemCreateEvent,
} from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

@customElement("bb-new-workspace-item-overlay")
export class NewWorkspaceItemOverlay extends LitElement {
  #formRef: Ref<HTMLFormElement> = createRef();

  static styles = css`
    :host {
      display: block;
    }

    form {
      display: flex;
      flex-direction: column;
      width: 85vw;
      max-width: 420px;
    }

    #container {
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr);
      column-gap: var(--bb-grid-size-4);
      row-gap: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-4);
    }

    #type-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: var(--bb-grid-size-2);
    }

    header {
      display: flex;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid var(--bb-neutral-300);
      margin: 0 0 var(--bb-grid-size) 0;
    }

    h1 {
      flex: 1;
      font-size: var(--bb-title-medium);
      margin: 0;
    }

    header .close {
      width: 16px;
      height: 16px;
      background: var(--bb-icon-close) center center no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    header .close:hover {
      transition-duration: 0.1s;
      opacity: 1;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      align-self: center;
    }

    textarea {
      height: 140px;
    }

    #controls {
      display: flex;
      justify-content: flex-end;
      margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 4);
    }

    .cancel {
      background: var(--bb-neutral-200);
      color: var(--bb-neutral-600);
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px;
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    input[type="submit"] {
      background: var(--bb-continue-color);
      background-image: var(--bb-icon-resume-blue);
      background-size: 16px 16px;
      background-position: 8px 4px;
      background-repeat: no-repeat;
      color: #246db5;
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px 0 28px;
      margin: 0;
    }

    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: var(--bb-grid-size-2);
      align-items: center;
    }

    .split div {
      display: flex;
      align-items: center;
    }

    .split label {
      margin-right: var(--bb-grid-size);
    }

    .split select,
    .split input,
    .split textarea {
      margin: 0;
    }

    .container {
      margin: 0 var(--bb-grid-size-4);
    }

    input[type="radio"] {
      display: none;
    }

    #type-container label {
      display: flex;
      height: 80px;
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-ui-100);
      justify-content: center;
      padding: var(--bb-grid-size-3);
      align-items: flex-end;
      cursor: pointer;
      font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    #type-container label[for="declarative"] {
      background: var(--bb-icon-board) center calc(50% - 12px) / 48px 48px
        no-repeat;
    }

    #type-container label[for="imperative"] {
      background: var(--bb-icon-code) center calc(50% - 12px) / 48px 48px
        no-repeat;
    }

    #type-container label:hover {
      border: 1px solid var(--bb-ui-300);
    }

    #type-container input:checked + label {
      border: 1px solid var(--bb-ui-300);
      box-shadow: 0 0 0 2px var(--bb-ui-300);
    }

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }
  `;

  protected firstUpdated(): void {
    if (!this.#formRef.value) {
      return;
    }

    const input = this.#formRef.value.querySelector(
      "input[type='text']"
    ) as HTMLInputElement;
    if (!input) {
      return;
    }

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  render() {
    return html`<bb-overlay elevated>
      <form
        ${ref(this.#formRef)}
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key === "Enter" && evt.metaKey && this.#formRef.value) {
            const form = this.#formRef.value;
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }

            form.dispatchEvent(new SubmitEvent("submit"));
          }
        }}
        @submit=${(evt: SubmitEvent) => {
          evt.preventDefault();
          if (!(evt.target instanceof HTMLFormElement)) {
            return;
          }

          const form = evt.target;
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const data = new FormData(evt.target);
          const title = data.get("title") as string | null;
          const type = data.get("item-type") as
            | "declarative"
            | "imperative"
            | null;
          if (!type || !title) {
            return;
          }

          this.dispatchEvent(new WorkspaceItemCreateEvent(type, title));
        }}
      >
        <header>
          <h1>New item...</h1>
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="close"
            type="button"
          >
            Close
          </button>
        </header>

        <div id="container">
          <label>Type</label>
          <div id="type-container">
            <input
              id="declarative"
              type="radio"
              name="item-type"
              value="declarative"
              checked
            />
            <label for="declarative">Visual Board</label>

            <input
              id="imperative"
              type="radio"
              name="item-type"
              value="imperative"
            />
            <label for="imperative">Code Board</label>
          </div>

          <label>Title</label>
          <input
            name="title"
            type="text"
            placeholder="Enter a title for the item"
            required
          />
        </div>

        <div id="controls">
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="cancel"
            type="button"
          >
            Cancel
          </button>
          <input type="submit" value="Save" />
        </div>
      </form>
    </bb-overlay>`;
  }
}
