/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DataPart, InlineDataCapabilityPart } from "@breadboard-ai/types";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Project } from "../../../state";
import { TextEditor } from "../text-editor/text-editor";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { icons } from "../../../styles/icons.js";
import { DrawableInput } from "../drawable/drawable";

@customElement("bb-llm-part-input")
export class LLMPartInput extends LitElement {
  @property()
  accessor graphUrl: URL | null = null;

  @property()
  accessor subType: string | null = null;

  @property()
  set dataPart(dataPart: DataPart | null) {
    this.#dataPart = structuredClone(dataPart);
  }
  get dataPart() {
    return this.#dataPart;
  }

  @property()
  accessor locked = false;

  @property()
  accessor projectState: Project | null = null;

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
      }

      bb-text-editor {
        width: 100%;
        height: 100%;
        --text-editor-height: 100%;
        --text-editor-padding-top: var(--bb-grid-size-3);
        --text-editor-padding-right: var(--bb-grid-size-6);
        --text-editor-padding-bottom: var(--bb-grid-size-3);
        --text-editor-padding-left: var(--bb-grid-size-6);
      }

      #url-input {
        display: grid;
        grid-template-columns: minmax(0, 1fr) min-content;
        column-gap: var(--bb-grid-size-2);
        width: 100%;
        padding: var(--bb-grid-size) var(--bb-grid-size-6) var(--bb-grid-size-5)
          var(--bb-grid-size-6);
        border-bottom: 1px solid var(--bb-neutral-100);

        & input {
          flex: 1;
          border-radius: var(--bb-grid-size);
          border: 1px solid var(--bb-neutral-300);
          height: var(--bb-grid-size-8);
          padding: 0 var(--bb-grid-size-2);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
        }
      }

      #text-input {
        display: grid;
        grid-template-rows: var(--bb-grid-size-15) minmax(0, 1fr);
        height: 100%;
        width: 100%;

        & > #apply-control {
          width: 100%;
          display: flex;
          justify-content: end;
          padding: var(--bb-grid-size) var(--bb-grid-size-6)
            var(--bb-grid-size-5) var(--bb-grid-size-6);
          border-bottom: 1px solid var(--bb-neutral-100);
        }
      }

      #drawable-input {
        & > #apply-control {
          width: 100%;
          display: flex;
          justify-content: end;
          padding: var(--bb-grid-size) var(--bb-grid-size-6)
            var(--bb-grid-size-5) var(--bb-grid-size-6);
          border-bottom: 1px solid var(--bb-neutral-100);
        }

        & #drawable-container {
          padding: var(--bb-grid-size-3) var(--bb-grid-size-6);
        }
      }

      .apply {
        height: var(--bb-grid-size-8);
        border-radius: var(--bb-grid-size-16);
        background: var(--bb-neutral-100);
        color: var(--bb-neutral-800);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        border: none;
        padding: 0 var(--bb-grid-size-3);
        white-space: nowrap;
        display: flex;
        align-items: center;

        & .g-icon {
          margin-right: var(--bb-grid-size);
        }

        &[disabled] {
          & .g-icon {
            animation: rotate 1s linear infinite;
          }
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background: var(--bb-neutral-200);
          }
        }
      }

      .no-edit-available {
        color: var(--bb-neutral-900);
        margin: var(--bb-grid-size) var(--bb-grid-size-6) var(--bb-grid-size-3)
          var(--bb-grid-size-6);
        padding: 0;
        font: normal italic var(--bb-body-small) /
          var(--bb-body-line-height-small) var(--bb-font-family);
      }

      @keyframes rotate {
        from {
          rotate: 0;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  #dataPart: DataPart | null = null;
  #inputRef: Ref<HTMLInputElement | DrawableInput | TextEditor> = createRef();

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("dataPart")) {
      this.locked = false;
    }
  }

  render() {
    if (isTextCapabilityPart(this.#dataPart)) {
      return html`<div id="text-input">
        <div id="apply-control">
          <button
            class="apply"
            ?disabled=${this.locked}
            @click=${() => {
              if (!this.#inputRef.value) {
                return;
              }

              if (!isTextCapabilityPart(this.#dataPart)) {
                return;
              }

              this.#dataPart.text = this.#inputRef.value.value;

              this.locked = true;
              this.dispatchEvent(new SubmitEvent("submit"));
            }}
          >
            <span class="g-icon"
              >${this.locked ? "progress_activity" : "check"}</span
            >
            Apply
          </button>
        </div>
        <bb-text-editor
          ${ref(this.#inputRef)}
          .projectState=${this.projectState}
          .supportsFastAccess=${true}
          .value=${this.#dataPart.text.trim()}
        ></bb-text-editor>
      </div>`;
    } else if (isFileDataCapabilityPart(this.#dataPart)) {
      if (this.subType === "youtube") {
        return html`<div id="url-input">
          <input
            ${ref(this.#inputRef)}
            type="url"
            name="youtube-url"
            autocomplete="off"
            placeholder="https://youtube.com/watch?v=<video>"
            .value=${this.#dataPart.fileData.fileUri}
            @keydown=${(evt: KeyboardEvent) => {
              if (
                evt.key !== "Enter" ||
                !isFileDataCapabilityPart(this.#dataPart)
              ) {
                return;
              }

              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              this.#dataPart.fileData.fileUri = evt.target.value;
              this.dispatchEvent(new SubmitEvent("submit"));
            }}
          />
          <button
            class="apply"
            ?disabled=${this.locked}
            @click=${() => {
              if (
                !isFileDataCapabilityPart(this.#dataPart) ||
                !this.#inputRef.value
              ) {
                return;
              }

              this.#dataPart.fileData.fileUri = this.#inputRef.value.value;
              this.locked = true;
              this.dispatchEvent(new SubmitEvent("submit"));
            }}
          >
            <span class="g-icon"
              >${this.locked ? "progress_activity" : "check"}</span
            >
            Apply
          </button>
        </div>`;
      }
    } else if (
      (isStoredData(this.#dataPart) || isInlineData(this.#dataPart)) &&
      this.subType === "drawable"
    ) {
      let url: URL | null = null;
      if (isStoredData(this.#dataPart)) {
        const handle = this.#dataPart.storedData.handle;
        if (handle.startsWith(".") && this.graphUrl) {
          url = new URL(handle, this.graphUrl);
        } else {
          url = new URL(handle);
        }
      } else if (isInlineData(this.#dataPart)) {
        url = new URL(
          `data:${this.#dataPart.inlineData.mimeType};base64,${this.#dataPart.inlineData.data}`
        );
      }

      return html`<div id="drawable-input">
        <div id="apply-control">
          <button
            class="apply"
            ?disabled=${this.locked}
            @click=${() => {
              if (!this.#inputRef.value) {
                return;
              }

              this.#dataPart = {
                inlineData: {
                  data: this.#inputRef.value.value,
                  mimeType: this.#inputRef.value.type,
                },
              } satisfies InlineDataCapabilityPart;

              this.locked = true;
              this.dispatchEvent(new SubmitEvent("submit"));
            }}
          >
            <span class="g-icon"
              >${this.locked ? "progress_activity" : "check"}</span
            >
            Apply
          </button>
        </div>
        <div id="drawable-container">
          <bb-drawable-input
            ${ref(this.#inputRef)}
            .url=${url}
          ></bb-drawable-input>
        </div>
      </div>`;
    }

    return nothing;
  }
}
