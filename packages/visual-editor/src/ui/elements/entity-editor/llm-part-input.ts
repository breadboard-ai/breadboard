/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DataPart, InlineDataCapabilityPart } from "@breadboard-ai/types";
import { isStoredData } from "@breadboard-ai/utils";
import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property } from "lit/decorators.js";

import { TextEditor } from "../input/text-editor/text-editor.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { icons } from "../../styles/icons.js";
import { DrawableInput } from "../input/drawable/drawable.js";
import { resolveImage } from "../../media/image.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isTextCapabilityPart,
} from "../../../data/common.js";

@customElement("bb-llm-part-input")
export class LLMPartInput extends SignalWatcher(LitElement) {
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

  @consume({ context: scaContext })
  accessor sca!: SCA;

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
        border-bottom: 1px solid var(--light-dark-n-98);

        & input {
          flex: 1;
          border-radius: var(--bb-grid-size);
          border: 1px solid var(--light-dark-n-90);
          height: var(--bb-grid-size-8);
          padding: 0 var(--bb-grid-size-2);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--light-dark-n-10);
        }
      }

      #text-input {
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        height: 100%;
        width: 100%;

        & > #apply-control {
          width: 100%;
          display: flex;
          justify-content: end;
          padding: var(--bb-grid-size) var(--bb-grid-size-6)
            var(--bb-grid-size-5) var(--bb-grid-size-6);
          border-bottom: 1px solid var(--light-dark-n-98);
        }
      }

      #drawable-input {
        & > #apply-control {
          width: 100%;
          display: flex;
          justify-content: end;
          padding: var(--bb-grid-size) var(--bb-grid-size-6)
            var(--bb-grid-size-5) var(--bb-grid-size-6);
          border-bottom: 1px solid var(--light-dark-n-98);
        }

        & #drawable-container {
          padding: var(--bb-grid-size-3) var(--bb-grid-size-6);
        }
      }

      .apply {
        height: var(--bb-grid-size-8);
        border-radius: var(--bb-grid-size-16);
        background: var(--light-dark-n-98);
        color: var(--light-dark-n-20);
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
            background: var(--light-dark-n-90);
          }
        }
      }

      .no-edit-available {
        color: var(--light-dark-n-10);
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
        <bb-text-editor
          ${ref(this.#inputRef)}
          .supportsFastAccess=${false}
          .value=${this.#dataPart.text.trim()}
          @input=${() => {
            if (
              !this.#inputRef.value ||
              !this.#dataPart ||
              !isTextCapabilityPart(this.#dataPart)
            ) {
              return;
            }

            this.#dataPart.text = this.#inputRef.value.value;
          }}
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
            @input=${() => {
              if (
                !this.#inputRef.value ||
                !this.#dataPart ||
                !isFileDataCapabilityPart(this.#dataPart)
              ) {
                return;
              }

              this.#dataPart.fileData.fileUri = this.#inputRef.value.value;
            }}
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
      let url: URL | Promise<string | undefined> | null = null;
      if (isStoredData(this.#dataPart)) {
        const handle = this.#dataPart.storedData.handle;
        if (handle.startsWith(".") && this.graphUrl) {
          url = new URL(handle, this.graphUrl);
        } else if (handle.startsWith("drive:")) {
          if (!this.sca.services.googleDriveClient) {
            // If googleDriveClient is not available, we can't resolve the image.
            // The original code set url to "about:blank", which is a valid URL.
            // To maintain similar behavior without a `continue` in render,
            // we can set it to a blank URL or handle it as an error state.
            // For now, setting to about:blank to avoid breaking the flow.
            url = new URL("about:blank");
          } else {
            url = resolveImage(this.sca.services.googleDriveClient, handle);
          }
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
            @input=${() => {
              if (!this.#inputRef.value) {
                return;
              }

              this.#dataPart = {
                inlineData: {
                  data: this.#inputRef.value.value,
                  mimeType: this.#inputRef.value.type,
                },
              } satisfies InlineDataCapabilityPart;
            }}
          ></bb-drawable-input>
        </div>
      </div>`;
    }

    return nothing;
  }
}
