/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { type InputEnterEvent } from "../../events/events.js";
import "../connection/connection-input.js";
import { loadDrivePicker } from "./google-apis.js";

@customElement("bb-google-drive-query")
export class GoogleDriveQuery extends LitElement {
  @state()
  private _authorization?: { clientId: string; secret: string };

  @state()
  private _pickerLib?: typeof google.picker;

  #picker?: google.picker.Picker;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._pickerLib ??= await loadDrivePicker();
  }

  override render() {
    if (this._authorization === undefined) {
      return html`<bb-connection-input
        @bbinputenter=${this.#onToken}
        connectionId="google-drive"
      ></bb-connection-input>`;
    }
    if (this._pickerLib === undefined) {
      return html`<p>Loading Google Drive Picker ...</p>`;
    }
    // TODO(aomarks) The actual input element.
    return html`
      <p>
        Only files that you choose to share with Breadboard will be matched by
        this query. Sharing a file is permanent and applies to all future
        queries from your signed-in account.
      </p>
      <button @click=${this.#onClickPickFiles}>Share Google Drive Files</button>
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
    // See https://developers.google.com/drive/picker/reference
    this.#picker = new this._pickerLib.PickerBuilder()
      .setAppId(this._authorization.clientId)
      .setOAuthToken(this._authorization.secret)
      .setCallback(this.#pickerCallback.bind(this))
      .addView(google.picker.ViewId.DOCS)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
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
        console.log(
          `Shared ${result.docs.length} Google Drive files with Breadboard`
        );
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
