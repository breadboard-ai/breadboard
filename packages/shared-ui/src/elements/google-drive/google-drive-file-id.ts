/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, PropertyValues, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  InputCancelEvent,
  InputChangeEvent,
  InputPlugin,
} from "../../plugins/input-plugin.js";
import "../connection/connection-input.js";
import {
  loadDrivePicker,
  loadDriveApi,
  loadGapiClient,
} from "./google-apis.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { getTopLevelOrigin } from "../../utils/embed-helpers.js";
import { StateEvent } from "../../events/events.js";

type PickedValue = {
  // A special value recognized by the "GraphPortLabel": if present in an
  // object, will be used as the preview value.
  preview: string;
  id: string;
  mimeType: string;
  /** The connection name under which the file was requested */
  connectionName: string;
};

type PickerMetadata = {
  docName?: string;
};

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
  private accessor _authorization:
    | { clientId: string; secret: string; expiresIn?: number }
    | undefined = undefined;

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
  accessor connectionName = "$sign-in";

  @property()
  accessor autoTrigger = false;

  #picker?: google.picker.Picker;
  #autoTrigger = false;
  #inputRef: Ref<HTMLButtonElement> = createRef();

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._pickerLib ??= await loadDrivePicker();
  }

  triggerFlow() {
    if (this._authorization === undefined) {
      throw new Error("No authorization");
    }

    if (this._pickerLib === undefined) {
      throw new Error("Google Drive API unavailable");
    }

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
    if (this._authorization === undefined) {
      return html`<bb-connection-input
        @bbevent=${this.#onToken}
        connectionId=${this.connectionName}
      ></bb-connection-input>`;
    }
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

  #onToken(event: StateEvent<"board.input">) {
    if (event.detail.eventType !== "board.input") {
      console.error(event);
      throw new Error("Unexpected token event");
    }
    // Prevent ui-controller from receiving an unexpected bbevent event.
    //
    // TODO(aomarks) Let's not re-use bbevent here, we should instead use
    // bbtokengranted, but there is a small bit of refactoring necessary for
    // that to work.
    event.stopImmediatePropagation();
    const { clientId, secret } = event.detail.data as {
      clientId?: string;
      secret?: string;
    };
    if (clientId && secret) {
      this._authorization = { clientId, secret };
    }
  }

  async #onCreateNewDoc() {
    if (this._authorization === undefined) return;

    const name = this.metadata?.docName ?? this.docName ?? "Untitled Document";
    const mimeType = "application/vnd.google-apps.document";

    try {
      this.inProgress = true;

      await loadGapiClient();
      gapi.auth.setToken({
        access_token: this._authorization.secret,
        error: "",
        expires_in: `${this._authorization.expiresIn ?? 3600}`,
        state: "https://www.googleapis.com/auth/drive",
      });
      const api = await loadDriveApi();
      const file = await api.files.create({
        resource: { name, mimeType },
        fields: "id",
      });
      const id = file.result.id!;
      this.docName = name;
      this.value = {
        id,
        preview: name,
        mimeType,
        connectionName: this.connectionName,
      };
      this.dispatchEvent(new InputChangeEvent(this.value));
    } finally {
      this.inProgress = false;
    }
  }

  #onClickPickFiles() {
    if (this._authorization === undefined || this._pickerLib === undefined) {
      return;
    }
    this.#destroyPicker();

    const myFilesView = new this._pickerLib.DocsView();
    myFilesView.setIncludeFolders(true);
    myFilesView.setSelectFolderEnabled(false);
    myFilesView.setOwnedByMe(true);
    myFilesView.setMode(google.picker.DocsViewMode.GRID);

    const sharedFilesView = new this._pickerLib.DocsView();
    sharedFilesView.setIncludeFolders(true);
    sharedFilesView.setSelectFolderEnabled(false);
    sharedFilesView.setOwnedByMe(false);
    sharedFilesView.setMode(google.picker.DocsViewMode.GRID);

    // See https://developers.google.com/drive/picker/reference
    this.#picker = new this._pickerLib.PickerBuilder()
      .setOrigin(getTopLevelOrigin())
      .addView(myFilesView)
      .addView(sharedFilesView)
      .setAppId(this._authorization.clientId)
      .setOAuthToken(this._authorization.secret)
      .setCallback(this.#pickerCallback.bind(this))
      // .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .build();
    this.#picker.setVisible(true);
  }

  #pickerCallback(result: google.picker.ResponseObject): void {
    switch (result.action) {
      case "cancel": {
        this.#destroyPicker();
        this.dispatchEvent(new InputCancelEvent());
        return;
      }
      case "picked": {
        this.#destroyPicker();
        // TODO(aomarks) Show this as a snackbar
        console.log(`Shared 1 Google Drive file with Breadboard`);
        if (result.docs && result.docs.length > 0) {
          const doc = result.docs[0];
          if (!doc) return;
          const { id, name = "", mimeType = "" } = doc;
          this.value = {
            id,
            preview: name,
            mimeType,
            connectionName: this.connectionName,
          };
          this.docName = name;
          this.dispatchEvent(new InputChangeEvent(this.value));
        }
      }
    }
  }

  #destroyPicker() {
    if (this.#picker === undefined) {
      return;
    }
    this.#picker.setVisible(false);
    this.#picker.dispose();
    this.#picker = undefined;
  }
}
