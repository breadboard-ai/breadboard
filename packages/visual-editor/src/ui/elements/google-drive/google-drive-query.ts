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
    return html`<em
      >Not yet implemented (${Object.keys(this._pickerLib).length})</em
    >`;
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
}
