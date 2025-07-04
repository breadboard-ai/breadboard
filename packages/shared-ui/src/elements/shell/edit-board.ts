/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { ModalDismissedEvent, StateEvent } from "../../events/events";

@customElement("bb-edit-board-modal")
export class EditBoardModal extends LitElement {
  @property()
  accessor boardTitle: string | null = null;

  @property()
  accessor boardDescription: string | null = null;

  @query("form")
  accessor #form: HTMLFormElement | null = null;

  static styles = [
    type,
    colorsLight,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      form {
        display: grid;
        row-gap: var(--bb-grid-size-3);
        width: 80svw;
        max-width: 380px;

        & input,
        & textarea {
          padding: var(--bb-grid-size-4);
          border-radius: var(--bb-grid-size-4);
          border: 1px solid var(--n-70);
          resize: none;
          field-sizing: content;
          max-height: 300px;
        }
      }
    `,
  ];

  render() {
    if (!this.boardTitle) {
      return nothing;
    }

    return html`<bb-modal
      .modalTitle=${"Edit name and description"}
      .showCloseButton=${true}
      .showSaveCancel=${true}
      @bbmodaldismissed=${(evt: ModalDismissedEvent) => {
        if (!evt.withSave || !this.#form) {
          return;
        }

        if (!this.#form.checkValidity()) {
          evt.preventDefault();
          this.#form.reportValidity();
          return;
        }

        const title = this.#form.querySelector<HTMLInputElement>("#title");
        const description =
          this.#form.querySelector<HTMLTextAreaElement>("#description");

        if (!title || !description) {
          return;
        }

        this.dispatchEvent(
          new StateEvent({
            eventType: "board.rename",
            title: title.value,
            description: description.value,
          })
        );
      }}
    >
      <form @submit=${(evt: SubmitEvent) => evt.preventDefault()}>
        <input
          class="sans-flex md-body-large round "
          placeholder=${"Untitled item"}
          id="title"
          name="title"
          required
          .value=${this.boardTitle}
        />
        <textarea
          class="sans-flex md-body-large round"
          placeholder=${"Optional description"}
          id="description"
          name="description"
          .value=${this.boardDescription}
        ></textarea>
      </form>
    </bb-modal>`;
  }
}
