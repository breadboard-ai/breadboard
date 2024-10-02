/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CommentConfiguration } from "../../types/types.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommentUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";

const DOCK_KEY = "bb-comment-overlay-docked";
const MAXIMIZE_KEY = "bb-comment-overlay-maximized";

@customElement("bb-comment-overlay")
export class CommentOverlay extends LitElement {
  @property()
  commentValue: CommentConfiguration | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();

  #pendingSave = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      z-index: 20;
    }

    #content {
      width: 100%;
      max-height: none;
      flex: 1;
      overflow-y: auto;
    }

    #container {
      padding: var(--bb-grid-size-4) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-4);
      height: 100%;
    }

    #buttons {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    #cancel {
      background: transparent;
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-right: var(--bb-grid-size-2);
    }

    #update {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-6) var(--bb-grid-size-2)
        var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #update::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #update:hover,
    #update:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    form {
      display: flex;
      row-gap: 4px;
      flex-direction: column;
      height: 100%;
    }

    input[type="text"],
    select,
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
      flex: 1;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }
  `;

  processData() {
    this.#pendingSave = false;

    if (
      !this.#formRef.value ||
      !this.commentValue ||
      !this.commentValue.value
    ) {
      return;
    }

    const commentEl =
      this.#formRef.value.querySelector<HTMLInputElement>("#comment");

    const id = this.commentValue.value.id;
    const text = commentEl?.value ?? "";
    const subGraphId = this.commentValue.subGraphId;

    this.dispatchEvent(new CommentUpdateEvent(id, text, subGraphId));
  }

  render() {
    if (!this.commentValue || !this.commentValue.value) {
      return nothing;
    }

    return html`<bb-drag-dock-overlay
      .dockable=${true}
      .x=${this.commentValue.x + 20}
      .y=${this.commentValue.y - 100}
      .overlayIcon=${"comment"}
      .overlayTitle=${"Comment"}
      .maximizeKey=${MAXIMIZE_KEY}
      .dockKey=${DOCK_KEY}
      @bboverlaydismissed=${(evt: Event) => {
        if (!this.#pendingSave) {
          return;
        }

        if (confirm("Close comment without saving first?")) {
          return;
        }

        evt.stopImmediatePropagation();
      }}
    >
      <div id="content">
        <div id="container">
          <form
            ${ref(this.#formRef)}
            @submit=${(evt: Event) => {
              evt.preventDefault();
            }}
            @input=${() => {
              this.#pendingSave = true;
            }}
            @keydown=${(evt: KeyboardEvent) => {
              const isMac = navigator.platform.indexOf("Mac") === 0;
              const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

              if (!(evt.key === "Enter" && isCtrlCommand)) {
                return;
              }

              this.processData();
            }}
          >
            <label>Enter your comment below</label>
            <textarea
              id="comment"
              name="comment"
              placeholder="Enter your comment"
              .value=${this.commentValue.value.text || ""}
            ></textarea>
          </form>
        </div>
      </div>
      <div id="buttons">
        <button
          id="cancel"
          @click=${() => {
            this.dispatchEvent(new OverlayDismissedEvent());
          }}
        >
          Cancel
        </button>
        <button
          id="update"
          @click=${() => {
            this.processData();
          }}
        >
          Update
        </button>
      </div>
    </bb-drag-dock-overlay>`;
  }
}
