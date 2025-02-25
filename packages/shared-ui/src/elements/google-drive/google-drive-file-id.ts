/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type InputEnterEvent } from "../../events/events.js";
import { InputChangeEvent, InputPlugin } from "../../plugins/input-plugin.js";
import "../connection/connection-input.js";
import { loadDrivePicker } from "./google-apis.js";

type PickedValue = {
  // A special value recognized by the "GraphPortLabel": if present in an
  // object, will be used as the preview value.
  preview: string;
  id: string;
  mimeType: string;
  /** The connection name under which the file was requested */
  connectionName: string;
};

const MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.file",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.map",
  "application/vnd.google-apps.photo",
  "application/vnd.google-apps.drawing",
].join(",");

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
      max-width: 400px;
    }

    button {
      background: var(--bb-inputs-500);
      border-radius: 20px;
      border: none;
      color: white;
      cursor: pointer;
      font-size: var(--bb-label-large);
      padding: 4px 18px;
      white-space: nowrap;
    }
    button:hover {
      background-color: var(--bb-inputs-400);
    }

    input {
      flex-grow: 1;
      font-size: 11px;
      margin-left: 14px;
      padding: 6px 8px;
    }
  `;

  @state()
  private accessor _authorization:
    | { clientId: string; secret: string }
    | undefined = undefined;

  @state()
  private accessor _pickerLib: typeof google.picker | undefined = undefined;

  @state()
  accessor docName = "";

  @property()
  accessor value: PickedValue | null = null;

  @property()
  accessor connectionName = "google-drive-limited";

  #picker?: google.picker.Picker;

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

  override render() {
    if (this._authorization === undefined) {
      return html`<bb-connection-input
        @bbinputenter=${this.#onToken}
        connectionId=${this.connectionName}
      ></bb-connection-input>`;
    }
    if (this._pickerLib === undefined) {
      return html`<p>Loading Google Drive Picker ...</p>`;
    }
    return html`
      <button @click=${this.#onClickPickFiles}>Pick File</button>
      <input type="text" disabled="true" .value=${this.value?.preview || ""} />
    `;
  }

  #onToken(event: InputEnterEvent) {
    // Prevent ui-controller from receiving an unexpected bbinputenter event.
    //
    // TODO(aomarks) Let's not re-use bbinputenter here, we should instead use
    // bbtokengranted, but there is a small bit of refactoring necessary for
    // that to work.
    event.stopImmediatePropagation();
    const { clientId, secret } = event.data as {
      clientId?: string;
      secret?: string;
    };
    if (clientId && secret) {
      this._authorization = { clientId, secret };
    }
  }

  #onClickPickFiles() {
    if (this._authorization === undefined || this._pickerLib === undefined) {
      return;
    }
    this.#destroyPicker();

    const view = new this._pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes(MIME_TYPES);
    view.setMode(google.picker.DocsViewMode.LIST);
    view.setOwnedByMe(true);

    // See https://developers.google.com/drive/picker/reference
    this.#picker = new this._pickerLib.PickerBuilder()
      .addView(view)
      .setAppId(this._authorization.clientId)
      .setOAuthToken(this._authorization.secret)
      .setCallback(this.#pickerCallback.bind(this))
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .build();
    this.#picker.setVisible(true);
  }

  #pickerCallback(result: google.picker.ResponseObject): void {
    switch (result.action) {
      case "cancel": {
        this.#destroyPicker();
        return;
      }
      case "picked": {
        this.#destroyPicker();
        // TODO(aomarks) Show this as a snackbar
        console.log(`Shared 1 Google Drive file with Breadboard`);
        if (result.docs.length > 0) {
          const { id, name, mimeType } = result.docs[0];
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
