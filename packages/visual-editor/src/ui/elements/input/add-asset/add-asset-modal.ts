/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LitElement,
  html,
  css,
  nothing,
  HTMLTemplateResult,
  PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  AddAssetEvent,
  OverlayDismissedEvent,
} from "../../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { InlineDataCapabilityPart, LLMContent } from "@breadboard-ai/types";
import { DrawableInput } from "../drawable/drawable.js";
import { GoogleDriveFileId } from "../../google-drive/google-drive-file-id.js";
import { WebcamVideoInput } from "../webcam/webcam-video.js";
import { type } from "../../../styles/host/type.js";

@customElement("bb-add-asset-modal")
export class AddAssetModal extends LitElement {
  @property()
  accessor assetType: string | null = null;

  @property()
  accessor allowedMimeTypes: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor visible = true;

  static styles = [
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        pointer-events: none;
      }

      :host(:not([visible])) {
        display: block;
        pointer-events: none;
        opacity: 0;

        & #content {
          display: block;
          pointer-events: none;
          opacity: 0;
        }
      }

      #container {
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;

        &::backdrop {
          background: oklch(
            from var(--light-dark-n-90, var(--light-dark-n-10)) l c h /
              calc(alpha * 0.1)
          );
        }
      }

      #content {
        background: var(--background-color, var(--light-dark-n-100));
        border: none;
        box-shadow:
          0px 8px 12px 6px rgba(0, 0, 0, 0.05),
          0px 4px 4px rgba(0, 0, 0, 0.1);

        border-radius: var(--bb-grid-size-3);
        display: flex;
        flex-direction: column;
        width: 90%;
        max-width: 640px;
        overflow: hidden;

        #controls-container {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        }

        #field-container {
          padding: var(--bb-grid-size-3);
        }

        & h1 {
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--text-color, var(--light-dark-n-10));
          margin: 0 0 var(--bb-grid-size-2) 0;
        }

        & input[type="text"],
        & input[type="url"],
        & input[type="number"],
        & input[type="file"],
        & textarea,
        & select {
          display: block;
          width: 100%;
          border-radius: var(--bb-grid-size);
          background: var(--light-dark-n-100, var(--light-dark-n-100));
          color: var(--light-dark-n-0, var(--light-dark-n-10));
          padding: var(--bb-grid-size-2);
          border: 1px solid var(--light-dark-n-40, var(--light-dark-n-90));
          resize: none;
        }

        & input[type="file"] {
          display: none;
        }

        & #uploading {
          display: flex;
          align-items: center;
          height: var(--bb-grid-size-8);
          padding-left: var(--bb-grid-size-8);
          background: var(--bb-progress) 4px center / 20px 20px no-repeat;
        }

        input::file-selector-button {
          height: var(--bb-grid-size-7);
          border-radius: var(--bb-grid-size-16);
          background: var(--secondary-color, var(--light-dark-n-98));
          color: var(--primary-text-color, var(--light-dark-n-10));
          border: none;
        }

        textarea {
          field-sizing: content;
        }

        bb-drawable-input {
          width: 100%;
        }

        & #cancel {
          background: transparent;
          color: var(--light-dark-n-0, var(--light-dark-n-40));
          border: none;
          margin-right: var(--bb-grid-size-4);
          height: var(--bb-grid-size-10);

          &:not([disabled]) {
            cursor: pointer;
          }
        }

        & #submit {
          display: block;
          background: var(--light-dark-n-0, var(--light-dark-n-98));
          color: var(--light-dark-n-100, var(--light-dark-n-40));
          border-radius: var(--bb-grid-size-16);
          border: none;
          padding: 0 var(--bb-grid-size-4);
          height: var(--bb-grid-size-10);

          &:not([disabled]) {
            cursor: pointer;
          }
        }
      }
    `,
  ];

  #inputRef: Ref<HTMLDivElement> = createRef();
  #containerRef: Ref<HTMLDialogElement> = createRef();
  #addDriveInputRef: Ref<GoogleDriveFileId> = createRef();

  async #processAndEmit() {
    if (!this.#containerRef.value) {
      return;
    }

    const inputs = this.#containerRef.value.querySelectorAll<
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | DrawableInput
      | GoogleDriveFileId
    >(
      "input,select,textarea,bb-drawable-input,bb-webcam-video-input,bb-google-drive-file-id"
    );

    let canSubmit = true;
    let item: LLMContent | null = null;
    for (const input of inputs) {
      const isPlatformInputField = !(
        input instanceof DrawableInput ||
        input instanceof GoogleDriveFileId ||
        input instanceof WebcamVideoInput
      );
      if (isPlatformInputField && !input.checkValidity()) {
        input.reportValidity();
        canSubmit = false;
        continue;
      }

      switch (this.assetType) {
        case "youtube": {
          if (!isPlatformInputField) {
            break;
          }

          item = {
            role: "user",
            parts: [
              { fileData: { fileUri: input.value, mimeType: "video/mp4" } },
            ],
          };
          break;
        }

        case "drawable": {
          if (!(input instanceof DrawableInput)) {
            return;
          }

          item = {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: input.value as string,
                  mimeType: input.type,
                },
              },
            ],
          };
          break;
        }

        case "webcam-video": {
          if (!(input instanceof WebcamVideoInput)) {
            return;
          }

          try {
            item = {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: input.value as string,
                    mimeType: input.type,
                  },
                },
              ],
            };
          } catch (err) {
            // The user hasn't recorded anything.
            console.warn(err);
          }
          break;
        }

        case "gdrive": {
          if (!(input instanceof GoogleDriveFileId) || !input.value) {
            break;
          }

          item = {
            role: "user",
            parts: [
              {
                storedData: {
                  handle: `drive:/${input.value.id}`,
                  mimeType: input.value.mimeType,
                  resourceKey: input.value.resourceKey,
                },
              },
            ],
          };
          break;
        }

        case "upload": {
          if (!(input instanceof HTMLInputElement)) {
            break;
          }

          if (!input.files) {
            break;
          }

          const fileData: Promise<InlineDataCapabilityPart>[] = [
            ...input.files,
          ].map((file) => {
            return new Promise((resolve, reject) => {
              const fileReader = new FileReader();
              fileReader.onloadend = () => {
                const premable = `data:${file.type};base64,`.length;
                const data = (fileReader.result as string).slice(premable);
                resolve({
                  inlineData: {
                    data,
                    mimeType: file.type,
                  },
                });
              };

              fileReader.onerror = () => reject();
              fileReader.readAsDataURL(file);
            });
          });

          const parts = await Promise.all(fileData);
          item = {
            role: "user",
            parts,
          };

          break;
        }
      }
    }

    if (!canSubmit || !item) {
      return;
    }

    this.dispatchEvent(new AddAssetEvent(item));
  }

  protected updated(): void {
    if (this.#inputRef.value) {
      this.#inputRef.value.click();
    }

    if (
      this.#containerRef.value &&
      (this.assetType === "upload" ||
        this.assetType === "drawable" ||
        this.assetType === "youtube" ||
        this.assetType === "webcam-video")
    ) {
      this.#containerRef.value.showModal();
    }
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("assetType") &&
      (this.assetType === "upload" || this.assetType === "gdrive")
    ) {
      this.visible = false;
    }
  }

  render() {
    if (!this.assetType) {
      return nothing;
    }

    let assetCollector: HTMLTemplateResult | symbol = nothing;
    let assetDone: HTMLTemplateResult | symbol = html`<div
      id="controls-container"
    >
      <button
        class="md-body-medium sans-flex w-400"
        id="cancel"
        @click=${() => {
          this.dispatchEvent(new OverlayDismissedEvent());
        }}
      >
        Cancel
      </button>

      <button
        class="md-body-medium sans-flex w-400"
        id="submit"
        @click=${() => {
          this.#processAndEmit();
        }}
      >
        Insert
      </button>
    </div>`;

    switch (this.assetType) {
      case "youtube":
        assetCollector = html`<div id="field-container">
          <input
            type="url"
            name="url"
            class="md-body-large sans-flex w-400"
            placeholder="https://www.youtube.com/watch?v=<video>"
            pattern="^https://www.youtube.com/(watch|embed|shorts).*"
            autocomplete="off"
          />
        </div>`;
        break;

      case "upload":
        assetCollector = html`<input
          type="file"
          name="file"
          required
          multiple
          accept=${this.allowedMimeTypes
            ? this.allowedMimeTypes
            : "image/*,audio/*,video/*,text/plain,application/pdf,text/csv"}
          ${ref(this.#inputRef)}
          @change=${() => {
            this.visible = true;
            this.#processAndEmit();
          }}
          @cancel=${() => {
            this.dispatchEvent(new OverlayDismissedEvent());
          }}
        />`;
        assetDone = html`<div id="uploading">Uploading</div>`;
        break;

      case "drawable":
        assetCollector = html`<bb-drawable-input></bb-drawable-input>`;
        break;

      case "webcam-video":
        assetCollector = html`<bb-webcam-video-input></bb-webcam-video-input>`;
        break;

      case "gdrive":
        assetCollector = html`
          <bb-google-drive-file-id
            id="add-drive-proxy"
            ${ref(this.#addDriveInputRef)}
            .autoTrigger=${true}
            .allowedMimeTypes=${this.allowedMimeTypes}
            @bbinputcancel=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            @bb-input-change=${() => {
              this.#processAndEmit();
            }}
          ></bb-google-drive-file-id>
        `;
        break;

      default:
        assetCollector = html`Unknown asset type`;
        break;
    }

    return html`<dialog
      id="container"
      ${ref(this.#containerRef)}
      @pointerdown=${() => {
        this.dispatchEvent(new OverlayDismissedEvent());
      }}
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }
        evt.preventDefault();
        this.dispatchEvent(new OverlayDismissedEvent());
      }}
    >
      <div
        id="content"
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (!(evt.key === "Enter" && isCtrlCommand)) {
            return;
          }

          this.#processAndEmit();
        }}
      >
        ${assetCollector} ${assetDone}
      </div>
    </dialog>`;
  }
}
