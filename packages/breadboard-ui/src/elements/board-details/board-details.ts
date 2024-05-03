/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BoardInfoUpdateEvent } from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";

const STORAGE_PREFIX = "bb-board-details";

@customElement("bb-board-details")
export class BoardDetails extends LitElement {
  @property()
  expanded = false;

  @property()
  boardTitle: string | null = null;

  @property()
  boardVersion: string | null = null;

  @property()
  boardDescription: string | null = null;

  @property()
  subGraphId: string | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      border-bottom: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
    }

    :host > h1 {
      position: sticky;
      margin: 0 0 var(--bb-grid-size) 0;
      top: 0;
      z-index: 2;
    }

    #unfold {
      cursor: pointer;
      width: 100%;
      display: grid;
      grid-template-columns: auto min-content;
      align-items: center;
      border: none;
      background: #fff;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      text-align: left;
    }

    #unfold::after {
      content: "";
      width: 20px;
      height: 20px;
      background: #fff var(--bb-icon-unfold-more) center center / 20px 20px
        no-repeat;
      justify-self: end;
    }

    #unfold.visible::after {
      background: #fff var(--bb-icon-unfold-less) center center / 20px 20px
        no-repeat;
    }

    form {
      display: none;
      grid-template-rows: 16px 28px;
      row-gap: 4px;
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
    }

    form.visible {
      display: grid;
    }

    input[type="text"],
    textarea {
      padding: var(--bb-grid-size);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    const isExpanded = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-expanded`
    );

    this.expanded = isExpanded === "true";
  }

  #emitUpdatedInfo() {
    const form = this.#formRef.value;
    if (!form) {
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    if (
      !(data.has("title") && data.has("version") && data.has("description"))
    ) {
      return;
    }

    this.dispatchEvent(
      new BoardInfoUpdateEvent(
        data.get("title") as string,
        data.get("version") as string,
        data.get("description") as string,
        this.subGraphId
      )
    );
  }

  render() {
    return html`<h1>
        <button
          id="unfold"
          class=${classMap({ visible: this.expanded })}
          @click=${() => {
            this.expanded = !this.expanded;

            globalThis.sessionStorage.setItem(
              `${STORAGE_PREFIX}-expanded`,
              this.expanded.toString()
            );
          }}
        >
          Board details
        </button>
      </h1>

      <form
        ${ref(this.#formRef)}
        class=${classMap({ visible: this.expanded })}
        @input=${(evt: Event) => {
          evt.preventDefault();
          evt.stopImmediatePropagation();

          this.#emitUpdatedInfo();
        }}
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key !== "Enter") {
            return;
          }

          this.#emitUpdatedInfo();
        }}
        @submit=${(evt: Event) => {
          evt.preventDefault();
        }}
      >
        <label>Title</label>
        <input
          name="title"
          type="text"
          placeholder="The title for this board"
          required
          .value=${this.boardTitle || ""}
        />

        <label>Version</label>
        <input
          name="version"
          pattern="\\d+\\.\\d+\\.\\d+"
          type="text"
          placeholder="The semver version for this board, e.g. 0.0.1"
          required
          .value=${this.boardVersion || ""}
        />

        <label>Description</label>
        <textarea
          name="description"
          placeholder="The description for this board"
          .value=${this.boardDescription || ""}
        ></textarea>
      </form> `;
  }
}
