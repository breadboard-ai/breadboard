/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  GoogleDriveFolderPickedEvent,
  type InputEnterEvent,
} from "../../events/events.js";
import "../connection/connection-input.js";
import { loadDrivePicker } from "./google-apis.js";

@customElement("bb-google-drive-directory-picker")
export class GoogleDriveDirectoryPicker extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      max-width: 400px;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
    }

    #sharing {
      display: flex;
      margin-top: 14px;
    }

    #sharing > button {
      background: var(--bb-inputs-500);
      border-radius: 20px;
      border: none;
      color: white;
      cursor: pointer;
      font-size: var(--bb-label-large);
      max-height: 32px;
      padding: 4px 18px;
      white-space: nowrap;
    }

    #sharing > button:hover {
      background-color: var(--bb-inputs-400);
    }

    #sharing > p {
      color: var(--bb-neutral-600);
      font-size: 11px;
      margin: 0 0 0 12px;
      text-align: justify;
    }

    bb-connection-input,
    .folder-choose {
      margin: var(--bb-grid-size-2);
    }
  `;

  @state()
  private accessor _authorization:
    | { clientId: string; secret: string }
    | undefined = undefined;

  @state()
  private accessor _pickerLib: typeof google.picker | undefined = undefined;

  #picker?: google.picker.Picker;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._pickerLib ??= await loadDrivePicker();
  }

  override render() {
    if (this._authorization === undefined) {
      return html`<bb-connection-input
        @bbinputenter=${this.#onToken}
        connectionId="$sign-in"
      ></bb-connection-input>`;
    }
    if (this._pickerLib === undefined) {
      return html`<p>Loading Google Drive Picker ...</p>`;
    }

    return html`
      <div class="folder-choose">
        <button @click=${this.#onClickPickFolders}>Choose folder</button>
      </div>
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

  #onClickPickFolders() {
    if (this._authorization === undefined || this._pickerLib === undefined) {
      return;
    }
    this.#destroyPicker();
    // See https://developers.google.com/drive/picker/reference
    this.#picker = new this._pickerLib.PickerBuilder()
      .setAppId(this._authorization.clientId)
      .setOAuthToken(this._authorization.secret)
      .setCallback(this.#pickerCallback.bind(this))
      .addView(
        new google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setMimeTypes("application/vnd.google-apps.folder")
      )
      .enableFeature(google.picker.Feature.MINE_ONLY)
      .build();
    this.#picker.setVisible(true);
  }

  #pickerCallback(result: google.picker.ResponseObject): void {
    switch (result[google.picker.Response.ACTION]) {
      case "cancel": {
        this.#destroyPicker();
        break;
      }

      case "picked": {
        const docs = result[google.picker.Response.DOCUMENTS];
        if (docs && docs.length) {
          const id = docs[0][google.picker.Document.ID];
          this.dispatchEvent(new GoogleDriveFolderPickedEvent(id));
        }
        break;
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
