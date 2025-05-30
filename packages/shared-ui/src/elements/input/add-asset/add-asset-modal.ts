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
import { AddAssetEvent, OverlayDismissedEvent } from "../../../events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { InlineDataCapabilityPart, LLMContent } from "@breadboard-ai/types";
import { DrawableInput } from "../drawable/drawable";
import { SIGN_IN_CONNECTION_ID } from "../../../utils/signin-adapter";
import { GoogleDriveFileId } from "../../google-drive/google-drive-file-id";
import { WebcamVideoInput } from "../webcam/webcam-video";

@customElement("bb-add-asset-modal")
export class AddAssetModal extends LitElement {
  @property()
  accessor assetType: string | null = null;

  @property()
  accessor allowedMimeTypes: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor visible = true;

  static styles = css`
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
          from var(--n-90, var(--bb-neutral-900)) l c h / calc(alpha * 0.1)
        );
      }
    }

    #content {
      background: var(--background-color, var(--bb-neutral-0));
      border: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size-3);
      display: flex;
      flex-direction: column;
      width: 90%;
      max-width: 640px;

      & h1 {
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        color: var(--text-color, var(--bb-neutral-900));
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
        background: var(--background-color, var(--bb-neutral-0));
        color: var(--text-color, var(--bb-neutral-900));
        padding: var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        resize: none;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
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
        background: var(--secondary-color, var(--bb-neutral-100));
        color: var(--primary-text-color, var(--bb-neutral-900));
        border: none;
      }

      textarea {
        field-sizing: content;
      }

      bb-drawable-input {
        width: 100%;
      }

      & button {
        display: block;
        background: var(--primary-color, var(--bb-neutral-100));
        color: var(--primary-text-color, var(--bb-neutral-700));
        border-radius: var(--bb-grid-size-16);
        border: none;
        opacity: 0.75;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family);
        height: var(--bb-grid-size-7);
        margin-top: var(--bb-grid-size-2);
        padding: 0 var(--bb-grid-size-3);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }
    }
  `;

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

        case "gdrive": {
          if (!(input instanceof GoogleDriveFileId) || !input.value) {
            break;
          }

          item = {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: input.value.id,
                  mimeType: input.value.mimeType,
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

    console.log(item);
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

    let title: HTMLTemplateResult | symbol = nothing;
    let assetCollector: HTMLTemplateResult | symbol = nothing;
    let assetDone: HTMLTemplateResult | symbol = html`<div>
      <button
        @click=${() => {
          this.#processAndEmit();
        }}
      >
        Done
      </button>
    </div>`;

    switch (this.assetType) {
      case "youtube":
        title = html`Add YouTube Video`;
        assetCollector = html`<input
          type="url"
          placeholder="https://www.youtube.com/watch?v=<video>"
          pattern="^https://www.youtube.com/(watch|embed|shorts).*"
        />`;
        break;

      case "upload":
        title = html`Upload from Device`;
        assetCollector = html`<input
          type="file"
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
        title = html`Add a Drawing`;
        assetCollector = html`<bb-drawable-input></bb-drawable-input>`;
        break;

      case "webcam-video":
        title = html`Add a Webcam Video`;
        assetCollector = html`<bb-webcam-video-input></bb-webcam-video-input>`;
        break;

      case "gdrive":
        title = html`Add from Google Drive`;
        assetCollector = html`
          <bb-google-drive-file-id
            id="add-drive-proxy"
            ${ref(this.#addDriveInputRef)}
            .connectionName=${SIGN_IN_CONNECTION_ID}
            .autoTrigger=${true}
            .ownedByMeOnly=${true}
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
        <h1>${title}</h1>
        ${assetCollector} ${assetDone}
      </div>
    </dialog>`;
  }
}
