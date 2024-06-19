/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BoardInfoUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

@customElement("bb-board-edit-overlay")
export class BoardEditOverlay extends LitElement {
  @property()
  boardTitle: string | null = null;

  @property()
  boardVersion: string | null = null;

  @property()
  boardDescription: string | null = null;

  @property()
  boardPublished: boolean | null = null;

  @property()
  boardIsTool: boolean | null = null;

  @property()
  subGraphId: string | null = null;

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
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 4);
      font-size: var(--bb-label-small);
      color: var(--bb-ui-600);
    }

    input[type="text"],
    textarea,
    select {
      margin: var(--bb-grid-size) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-body-small);
      font-family: var(--bb-font-family);
      border: 1px solid var(--bb-neutral-400);
      resize: none;
      line-height: 1.5;
      border-radius: var(--bb-grid-size);
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
  `;

  protected firstUpdated(): void {
    if (!this.#formRef.value) {
      return;
    }

    const input = this.#formRef.value.querySelector(
      "input"
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
    return html`<bb-overlay>
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

          const data = new FormData(evt.target);
          this.dispatchEvent(
            new BoardInfoUpdateEvent(
              data.get("title") as string,
              data.get("version") as string,
              data.get("description") as string,
              data.get("status") as "published" | "draft" | null,
              data.get("tool") === "on",
              this.subGraphId
            )
          );
        }}
      >
        <header>
          <h1>
            ${this.subGraphId
              ? html`Sub Board Information - ${this.subGraphId}`
              : html`Board Information`}
          </h1>
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
        <label>Title</label>
        <input
          name="title"
          type="text"
          required
          .value=${this.boardTitle || ""}
        />

        <label>Version</label>
        <input
          name="version"
          pattern="\\d+\\.\\d+\\.\\d+"
          type="text"
          required
          .value=${this.boardVersion || ""}
        />

        <label>Description</label>
        <textarea
          name="description"
          .value=${this.boardDescription || ""}
        ></textarea>

        <div class="split">
          ${this.boardPublished !== null
            ? html`
                <div>
                  <label>Status</label>
                  <select
                    @input=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLSelectElement)) {
                        return;
                      }

                      if (
                        this.boardPublished &&
                        evt.target.value !== "published"
                      ) {
                        if (
                          !confirm(
                            "This board was published. Unpublishing it may break other boards. Are you sure?"
                          )
                        ) {
                          evt.preventDefault();
                          evt.target.value = "published";
                        }
                      }
                    }}
                    name="status"
                    .value=${this.boardPublished ? "published" : "draft"}
                  >
                    <option value="draft" ?selected=${!this.boardPublished}>
                      Draft
                    </option>
                    <option value="published" ?selected=${this.boardPublished}>
                      Published
                    </option>
                  </select>
                </div>
              `
            : nothing}
          ${this.boardIsTool !== null
            ? html`
                <div>
                  <label>Tool</label>
                  <input
                    name="tool"
                    type="checkbox"
                    .value="on"
                    ?checked=${this.boardIsTool}
                  />
                </div>
              `
            : nothing}
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
