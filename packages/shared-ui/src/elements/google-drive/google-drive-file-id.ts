/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import {
  InputCancelEvent,
  InputChangeEvent,
  type InputPlugin,
} from "../../plugins/input-plugin.js";
import { opalShellContext } from "../../utils/opal-shell-guest.js";

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

export const googleDriveFileIdInputPlugin: InputPlugin = {
  instantiate: {
    customElementName: "bb-google-drive-file-id",
  },
  match: {
    schema: {
      type: "object",
      behavior: ["google-drive-file-id"],
    },
  },
};

@customElement("bb-google-drive-file-id")
export class GoogleDriveFileId extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      max-width: 400px;
    }

    button {
      background: var(--secondary-color, var(--bb-neutral-100));
      border-radius: var(--bb-grid-size-16);
      border: none;
      color: var(--primary-text-color, var(--bb-neutral-700));
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
      background: var(--background-color, var(--bb-neutral-0));
      color: var(--text-color, var(--bb-neutral-900));
      padding: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);
      resize: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }
  `;

  @state()
  private accessor _pickerLib: typeof google.picker | undefined = undefined;

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

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  @consume({ context: opalShellContext })
  accessor opalShell: OpalShellProtocol | undefined;

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
    if (this._pickerLib === undefined) {
      return html`<p>Loading Google Drive Picker ...</p>`;
    }
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
    if (!this.googleDriveClient) {
      console.error("google drive client was not provided");
      return;
    }

    const name = this.metadata?.docName ?? this.docName ?? "Untitled Document";
    const mimeType = "application/vnd.google-apps.document";

    try {
      this.inProgress = true;
      const file = await this.googleDriveClient.createFileMetadata(
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
    if (this.opalShell === undefined) {
      return;
    }
    const result = await this.opalShell.pickDriveFiles({
      mimeTypes: ALLOWED_MIME_TYPES,
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
