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
import { AssetMetadata, LLMContent } from "@breadboard-ai/types";
import { DrawableInput } from "../drawable/drawable.js";
import { GoogleDriveFileId } from "../../google-drive/google-drive-file-id.js";
import { WebcamVideoInput } from "../webcam/webcam-video.js";
import { type GraphAsset } from "../../../../sca/types.js";
import * as Styles from "../../../styles/styles.js";
import { until } from "lit/directives/until.js";
import { resolveImage } from "../../../media/image.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import { NOTEBOOKLM_MIMETYPE } from "@breadboard-ai/utils";
import { notebookLmIcon } from "../../../styles/svg-icons.js";
import {
  videoIdFromWatchOrShortsOrEmbedUri,
  isShareUri,
  convertShareUriToEmbedUri,
} from "../../../../utils/media/youtube.js";
import { SignalWatcher } from "@lit-labs/signals";

@customElement("bb-add-asset-modal")
export class AddAssetModal extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  @property({ attribute: false })
  accessor sca!: SCA;

  @property()
  accessor assetType: string | null = null;

  @property()
  accessor allowedMimeTypes: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor visible = true;

  @property({ type: Object })
  accessor editingAsset: GraphAsset | null = null;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
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
          animation: backdrop-fade 0.2s ease-out forwards;
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
        animation: modal-entrance 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;

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

        .preview-container {
          display: flex;
          justify-content: center;
          padding: var(--bb-grid-size-4);
          background: var(--light-dark-n-95);
          border-radius: var(--bb-grid-size-2);
          margin-bottom: var(--bb-grid-size-4);
        }

        .preview-media {
          max-width: 100%;
          max-height: 200px;
          object-fit: contain;
          border-radius: var(--bb-grid-size);
        }

        .preview-audio {
          width: 100%;
        }

        .preview-card {
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-3);
          padding: var(--bb-grid-size-4);
          background: var(--light-dark-n-95);
          border-radius: var(--bb-grid-size-2);
          margin-bottom: var(--bb-grid-size-4);
          width: 100%;

          & .g-icon {
            font-size: 36px;
          }

          & .notebooklm-icon-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            color: #8f39fd;
            flex-shrink: 0;

            & svg {
              width: 36px;
              height: 36px;
            }
          }

          & .card-title {
            font-weight: 500;
            color: var(--light-dark-n-10);
            word-break: break-all;
          }

          & .card-meta {
            font-size: 11px;
            color: var(--light-dark-n-40);
          }
        }

        .preview-text-block {
          padding: var(--bb-grid-size-4);
          background: var(--light-dark-n-95);
          border-radius: var(--bb-grid-size-2);
          margin-bottom: var(--bb-grid-size-4);
          max-height: 150px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 11px;
          white-space: pre-wrap;
          width: 100%;
        }
      }

      @keyframes modal-entrance {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes backdrop-fade {
        from {
          background: transparent;
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
        }
        to {
          background: oklch(
            from var(--light-dark-n-90, var(--light-dark-n-10)) l c h /
              calc(alpha * 0.2)
          );
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
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

    const titleInput =
      this.#containerRef.value.querySelector<HTMLInputElement>("#asset-title");
    let defaultTitle = "Asset";
    switch (this.assetType) {
      case "youtube":
        defaultTitle = "YouTube Video";
        break;
      case "drawable":
        defaultTitle = "Drawing";
        break;
      case "webcam-video":
        defaultTitle = "Webcam Video";
        break;
      case "gdrive":
        defaultTitle = "Google Drive File";
        break;
      case "upload":
        defaultTitle = "Uploaded File";
        break;
      case "notebooklm":
        defaultTitle = "NotebookLM";
        break;
    }
    const updatedTitle =
      titleInput?.value || this.editingAsset?.metadata?.title || defaultTitle;

    if (
      this.editingAsset &&
      (this.assetType === "gdrive" || this.assetType === "notebooklm")
    ) {
      const metadata: AssetMetadata = {
        title: updatedTitle,
        type: this.editingAsset.metadata?.type || "file",
        subType: this.editingAsset.metadata?.subType,
      };
      this.dispatchEvent(
        new AddAssetEvent(this.editingAsset.data[0], metadata)
      );
      return;
    }

    for (const input of inputs) {
      if (input === titleInput) {
        continue;
      }

      const isPlatformInputField = !(
        input instanceof DrawableInput ||
        input instanceof GoogleDriveFileId ||
        input instanceof WebcamVideoInput
      );
      if (isPlatformInputField && !input.checkValidity()) {
        input.reportValidity();
        continue;
      }

      let item: LLMContent;
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
          const metadata: AssetMetadata = {
            title: updatedTitle,
            type: "content",
            subType: "youtube",
          };

          this.dispatchEvent(new AddAssetEvent(item, metadata));
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
          const metadata: AssetMetadata = {
            title: updatedTitle,
            type: "file",
            subType: input.type,
          };

          this.dispatchEvent(new AddAssetEvent(item, metadata));
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
            const metadata: AssetMetadata = {
              title: updatedTitle,
              type: "file",
              subType: "webcam-video",
            };

            this.dispatchEvent(new AddAssetEvent(item, metadata));
          } catch (err) {
            // The user hasn't recorded anything. If editing, keep original.
            if (this.editingAsset) {
              const metadata: AssetMetadata = {
                title: updatedTitle,
                type: "file",
                subType: this.editingAsset.metadata?.subType,
              };
              this.dispatchEvent(
                new AddAssetEvent(this.editingAsset.data[0], metadata)
              );
            } else {
              console.warn(err);
            }
          }
          break;
        }

        case "gdrive": {
          if (!(input instanceof GoogleDriveFileId)) {
            break;
          }

          if (!input.value) {
            if (this.editingAsset) {
              const metadata: AssetMetadata = {
                title: updatedTitle,
                type: "file",
                subType: this.editingAsset.metadata?.subType,
              };
              this.dispatchEvent(
                new AddAssetEvent(this.editingAsset.data[0], metadata)
              );
            }
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
          const metadata: AssetMetadata = {
            title: input.metadata?.docName || input.docName || updatedTitle,
            type: "file",
            subType: input.value.mimeType,
          };

          this.dispatchEvent(new AddAssetEvent(item, metadata));
          break;
        }

        case "upload": {
          if (!(input instanceof HTMLInputElement)) {
            break;
          }

          if (!input.files || input.files.length === 0) {
            if (this.editingAsset) {
              const metadata: AssetMetadata = {
                title: updatedTitle,
                type: "file",
                subType: this.editingAsset.metadata?.subType,
              };
              this.dispatchEvent(
                new AddAssetEvent(this.editingAsset.data[0], metadata)
              );
            }
            break;
          }

          for (const file of [...input.files]) {
            const dataUrlPromise = new Promise<{
              inlineData: { data: string; mimeType: string };
            }>((resolve, reject) => {
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

            const part = await dataUrlPromise;
            const singleItem: LLMContent = {
              role: "user",
              parts: [part],
            };

            const metadata: AssetMetadata = {
              title: file.name,
              type: "file",
              subType: file.type,
            };

            this.dispatchEvent(new AddAssetEvent(singleItem, metadata));
          }

          break;
        }
      }
    }
  }

  protected updated(): void {
    if (this.#inputRef.value && !this.editingAsset) {
      this.#inputRef.value.click();
    }

    if (
      this.#containerRef.value &&
      (this.editingAsset ||
        this.assetType === "upload" ||
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
      !this.editingAsset &&
      (this.assetType === "upload" || this.assetType === "gdrive")
    ) {
      this.visible = false;
    }
  }

  #renderPreview(): HTMLTemplateResult | symbol {
    if (!this.editingAsset) {
      return nothing;
    }

    const firstPart = this.editingAsset.data[0]?.parts[0];
    if (!firstPart) {
      return nothing;
    }

    let mimeType = this.editingAsset.metadata?.subType || "";
    let srcUrl = "";
    let isGoogleDrive = false;

    if ("inlineData" in firstPart && firstPart.inlineData) {
      mimeType = firstPart.inlineData.mimeType;
      srcUrl = `data:${firstPart.inlineData.mimeType};base64,${firstPart.inlineData.data}`;
    } else if ("storedData" in firstPart && firstPart.storedData) {
      mimeType = firstPart.storedData.mimeType || mimeType;
      srcUrl = firstPart.storedData.handle;
      if (firstPart.storedData.handle.startsWith("drive:/")) {
        isGoogleDrive = true;
      }
    } else if ("fileData" in firstPart && firstPart.fileData) {
      mimeType = firstPart.fileData.mimeType || mimeType;
      srcUrl = firstPart.fileData.fileUri;
    }

    // If no mimeType is set yet, infer it from the path or title
    if (!mimeType) {
      const source = (
        this.editingAsset.metadata?.title || this.editingAsset.path
      ).toLowerCase();
      if (source.endsWith(".png")) mimeType = "image/png";
      else if (source.endsWith(".jpg") || source.endsWith(".jpeg"))
        mimeType = "image/jpeg";
      else if (source.endsWith(".gif")) mimeType = "image/gif";
      else if (source.endsWith(".webp")) mimeType = "image/webp";
      else if (source.endsWith(".svg")) mimeType = "image/svg+xml";
      else if (source.endsWith(".mp3")) mimeType = "audio/mp3";
      else if (source.endsWith(".wav")) mimeType = "audio/wav";
      else if (source.endsWith(".mp4")) mimeType = "video/mp4";
      else if (source.endsWith(".pdf")) mimeType = "application/pdf";
      else if (source.endsWith(".txt")) mimeType = "text/plain";
      else if (source.endsWith(".json")) mimeType = "application/json";
    }

    if (mimeType === NOTEBOOKLM_MIMETYPE || mimeType === "notebooklm") {
      return html`<div class="preview-card">
        <div class="notebooklm-icon-wrapper">${notebookLmIcon}</div>
        <div>
          <div class="card-title">
            ${this.editingAsset.metadata?.title ||
            this.editingAsset.path.split("/").pop()}
          </div>
          <div class="card-meta">NotebookLM Reference</div>
        </div>
      </div>`;
    }

    if (mimeType.startsWith("image/")) {
      const resolvedSrc =
        srcUrl.startsWith("drive:/") && this.sca.services.googleDriveClient
          ? resolveImage(this.sca.services.googleDriveClient, srcUrl)
          : Promise.resolve(srcUrl);

      return html`<div class="preview-container">
        ${until(
          resolvedSrc.then(
            (src) => html`<img src=${src || ""} class="preview-media" />`
          ),
          html`<div
            class="preview-media"
            style="display: flex; align-items: center; justify-content: center; height: 150px; color: var(--light-dark-n-40);"
          >
            <span
              class="g-icon filled"
              style="font-size: 24px; font-family: 'Google Symbols'; color: var(--light-dark-n-40);"
              >progress_activity</span
            >
          </div>`
        )}
      </div>`;
    }

    if (isGoogleDrive) {
      return html`<div class="preview-card">
        <span
          class="g-icon filled"
          style="font-family: 'Google Symbols'; color: #4285f4;"
          >description</span
        >
        <div>
          <div class="card-title">
            ${this.editingAsset.metadata?.title ||
            this.editingAsset.path.split("/").pop()}
          </div>
          <div class="card-meta">Google Drive File (${mimeType})</div>
        </div>
      </div>`;
    }

    if (mimeType.startsWith("audio/")) {
      return html`<div class="preview-container">
        <audio controls src=${srcUrl} class="preview-audio"></audio>
      </div>`;
    }

    if (mimeType.startsWith("video/") || mimeType === "youtube") {
      let videoId: string | null = null;
      if (isShareUri(srcUrl)) {
        const embedUri = convertShareUriToEmbedUri(srcUrl);
        if (embedUri) {
          videoId = videoIdFromWatchOrShortsOrEmbedUri(embedUri);
        }
      } else {
        videoId = videoIdFromWatchOrShortsOrEmbedUri(srcUrl);
      }

      if (videoId) {
        return html`<div class="preview-container">
          <img
            src="https://img.youtube.com/vi/${videoId}/0.jpg"
            class="preview-media"
          />
        </div>`;
      }

      return html`<div class="preview-container">
        <video controls src=${srcUrl} class="preview-media"></video>
      </div>`;
    }

    if (
      "inlineData" in firstPart &&
      firstPart.inlineData &&
      (mimeType.startsWith("text/") || mimeType === "application/json")
    ) {
      try {
        const decoded = atob(firstPart.inlineData.data);
        const previewText =
          decoded.length > 500 ? decoded.slice(0, 500) + "..." : decoded;
        return html`<div class="preview-text-block">${previewText}</div>`;
      } catch (e) {
        console.warn("Failed to decode inline text asset:", e);
      }
    }

    const extBadge = mimeType
      ? mimeType.split("/").pop()?.toUpperCase()
      : "FILE";
    return html`<div class="preview-card">
      <span
        class="g-icon filled"
        style="font-family: 'Google Symbols'; color: var(--light-dark-n-40);"
        >description</span
      >
      <div>
        <div class="card-title">
          ${this.editingAsset.metadata?.title ||
          this.editingAsset.path.split("/").pop()}
        </div>
        <div class="card-meta">${extBadge} Asset</div>
      </div>
    </div>`;
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
        ${this.editingAsset ? "Save" : "Insert"}
      </button>
    </div>`;

    // Visual Preview building
    const preview = this.#renderPreview();

    switch (this.assetType) {
      case "youtube": {
        let editUrl = "";
        if (this.editingAsset) {
          const firstPart = this.editingAsset.data[0]?.parts[0];
          if (firstPart && "fileData" in firstPart && firstPart.fileData) {
            editUrl = firstPart.fileData.fileUri;
          }
        }
        assetCollector = html`<div id="field-container">
          ${preview}
          <div style="margin-top: var(--bb-grid-size-4);">
            <label
              class="md-label-medium"
              for="youtube-url"
              style="display: block; margin-bottom: var(--bb-grid-size-1); color: var(--light-dark-n-40);"
              >YouTube URL</label
            >
            <input
              id="youtube-url"
              type="url"
              name="url"
              .value=${editUrl}
              class="md-body-large sans-flex w-400"
              placeholder="https://www.youtube.com/watch?v=<video>"
              pattern="^https://www.youtube.com/(watch|embed|shorts).*"
              autocomplete="off"
              required
            />
          </div>
        </div>`;
        break;
      }

      case "upload": {
        if (this.editingAsset) {
          assetCollector = html`<div id="field-container">
            ${preview}
            <div style="margin-top: var(--bb-grid-size-4);">
              <label
                class="md-label-medium"
                for="new-file-upload"
                style="display: block; margin-bottom: var(--bb-grid-size-1); color: var(--light-dark-n-40);"
                >Replace File (Optional)</label
              >
              <input
                id="new-file-upload"
                type="file"
                name="file"
                accept=${this.allowedMimeTypes
                  ? this.allowedMimeTypes
                  : "image/*,audio/*,video/*,text/plain,application/pdf,text/csv"}
                style="display: block; width: 100%;"
              />
            </div>
          </div>`;
        } else {
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
        }
        break;
      }

      case "drawable": {
        let drawingUrl: URL | null = null;
        if (this.editingAsset) {
          const firstPart = this.editingAsset.data[0]?.parts[0];
          if (firstPart && "inlineData" in firstPart && firstPart.inlineData) {
            const dataUrl = `data:${firstPart.inlineData.mimeType};base64,${firstPart.inlineData.data}`;
            try {
              drawingUrl = new URL(dataUrl);
            } catch {
              // Ignore invalid url conversion
            }
          }
        }
        assetCollector = html`<div id="field-container">
          <bb-drawable-input .url=${drawingUrl}></bb-drawable-input>
        </div>`;
        break;
      }

      case "webcam-video":
        assetCollector = html`<bb-webcam-video-input></bb-webcam-video-input>`;
        break;

      case "gdrive": {
        if (this.editingAsset) {
          assetCollector = html`<div id="field-container">${preview}</div>`;
        } else {
          assetCollector = html`
            <bb-google-drive-file-id
              id="add-drive-proxy"
              ${ref(this.#addDriveInputRef)}
              .autoTrigger=${true}
              @bbinputcancel=${() => {
                this.dispatchEvent(new OverlayDismissedEvent());
              }}
              @bb-input-change=${() => {
                this.#processAndEmit();
              }}
            ></bb-google-drive-file-id>
          `;
        }
        break;
      }

      case "notebooklm":
        assetCollector = html`<div id="field-container">${preview}</div>`;
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
        ${this.editingAsset
          ? html`<div
              id="title-container"
              style="padding: var(--bb-grid-size-4) var(--bb-grid-size-4) 0 var(--bb-grid-size-4); display: flex; flex-direction: column; gap: var(--bb-grid-size-1);"
            >
              <label
                class="md-label-medium"
                for="asset-title"
                style="color: var(--light-dark-n-40); font-weight: 500;"
                >Asset Title</label
              >
              <input
                id="asset-title"
                type="text"
                name="title"
                .value=${this.editingAsset.metadata?.title || ""}
                class="md-body-large sans-flex w-400"
                required
                style="width: 100%; padding: var(--bb-grid-size-2); border-radius: var(--bb-grid-size); border: 1px solid var(--light-dark-n-80);"
              />
            </div>`
          : nothing}
        ${assetCollector} ${assetDone}
      </div>
    </dialog>`;
  }
}
