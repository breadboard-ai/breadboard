/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  InputCancelEvent,
  InputChangeEvent,
} from "../../plugins/input-plugin.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

export type PickedValue = {
  // A special value recognized by the "GraphPortLabel": if present in an
  // object, will be used as the preview value.
  preview: string;
  id: string;
  mimeType: string;
  resourceKey?: string;
};

type PickerMetadata = {
  docName?: string;
};

const ALLOWED_MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.file",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.map",
  "application/vnd.google-apps.photo",
  "application/vnd.google-apps.drawing",

  // https://ai.google.dev/gemini-api/docs/document-processing
  "application/pdf",

  // https://ai.google.dev/gemini-api/docs/image-understanding
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",

  // https://ai.google.dev/gemini-api/docs/video-understanding
  "video/mp4",
  "video/mpeg",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/webm",
  "video/wmv",
  "video/3gpp",

  // https://ai.google.dev/gemini-api/docs/audio
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
];

@customElement("bb-google-drive-file-id")
export class GoogleDriveFileId extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      max-width: 400px;
    }

    button {
      background: var(--secondary-color, var(--light-dark-n-98));
      border-radius: var(--bb-grid-size-16);
      border: none;
      color: var(--primary-text-color, var(--light-dark-n-40));
      font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size-3);
      white-space: nowrap;
      opacity: 0.7;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      margin-right: var(--bb-grid-size-2);

      &:not([disabled]) {
        cursor: pointer;

        &:hover,
        &:focus {
          opacity: 1;
        }
      }
    }

    input {
      flex-grow: 1;
      display: block;
      width: 100%;
      border-radius: var(--bb-grid-size);
      background: var(--background-color, var(--light-dark-n-100));
      color: var(--text-color, var(--light-dark-n-10));
      padding: var(--bb-grid-size-2);
      border: 1px solid var(--light-dark-n-90);
      resize: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }
  `;

  @state()
  accessor docName = "";

  @state()
  accessor inProgress = false;

  @property()
  accessor value: PickedValue | null = null;

  @property()
  accessor metadata: PickerMetadata | null = null;

  @property()
  accessor autoTrigger = false;

  @property()
  accessor allowedMimeTypes: string | null = null;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  #autoTrigger = false;
  #inputRef: Ref<HTMLButtonElement> = createRef();

  triggerFlow() {
    this.#onClickPickFiles();
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("autoTrigger") && this.autoTrigger) {
      this.#autoTrigger = true;
      this.autoTrigger = false;
    }
  }

  protected updated(): void {
    if (this.#inputRef.value && this.#autoTrigger) {
      this.#inputRef.value.click();
      this.#autoTrigger = false;
    }
  }

  override render() {
    if (this.inProgress) {
      return html`<p>Working ...</p>`;
    }
    return html`
      <button
        @click=${this.#onClickPickFiles}
        ${this.#autoTrigger ? ref(this.#inputRef) : nothing}
      >
        Pick File
      </button>
      ${this.value
        ? html`<input
            type="text"
            disabled
            .value=${this.value.preview || ""}
          />`
        : html`<button @click=${this.#onCreateNewDoc}>
            Create New Document
          </button>`}
    `;
  }

  async #onCreateNewDoc() {
    const googleDriveClient = this.sca.services.googleDriveClient;
    if (!googleDriveClient) {
      console.error("google drive client was not provided");
      return;
    }
    const name = this.metadata?.docName ?? this.docName ?? "Untitled Document";
    const mimeType = "application/vnd.google-apps.document";

    try {
      this.inProgress = true;
      const file = await googleDriveClient.createFileMetadata(
        { name, mimeType },
        { fields: ["id"] }
      );
      const id = file.id;
      this.docName = name;
      this.value = {
        id,
        preview: name,
        mimeType,
      };
      this.dispatchEvent(new InputChangeEvent(this.value));
    } finally {
      this.inProgress = false;
    }
  }

  async #onClickPickFiles() {
    if (this.sca.env.shellHost === undefined) {
      return;
    }
    const mimeTypes = this.allowedMimeTypes
      ? ALLOWED_MIME_TYPES.filter((m) => {
          const pattern = this.allowedMimeTypes!;
          if (pattern.endsWith("/*")) {
            return m.startsWith(pattern.slice(0, -1));
          }
          return m === pattern;
        })
      : ALLOWED_MIME_TYPES;
    const result = await this.sca.env.shellHost.pickDriveFiles({
      mimeTypes,
    });
    switch (result.action) {
      case "cancel": {
        this.dispatchEvent(new InputCancelEvent());
        return;
      }
      case "picked": {
        console.log(`Shared 1 Google Drive file with Breadboard`);
        if (result.docs && result.docs.length > 0) {
          const doc = result.docs[0];
          if (!doc) return;
          const { id, name = "", mimeType = "", resourceKey } = doc;
          this.value = {
            id,
            preview: name,
            mimeType,
            resourceKey,
          };
          this.docName = name;
          this.dispatchEvent(new InputChangeEvent(this.value));
        }
      }
    }
  }
}
