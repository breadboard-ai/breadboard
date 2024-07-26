/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from "@lit/task";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { type InputEnterEvent } from "../../events/events.js";
import "../connection/connection-input.js";
import { loadDrivePicker } from "./google-apis.js";

@customElement("bb-google-drive-query")
export class GoogleDriveQuery extends LitElement {
  @state()
  private _authorization?: { clientId: string; secret: string };

  #loadPickerLib = new Task(
    this,
    () => loadDrivePicker(),
    () => []
  );

  override render() {
    if (!this._authorization) {
      return html`<bb-connection-input
        @bbinputenter=${this.#onToken}
        connectionId="google-drive"
      ></bb-connection-input>`;
    }

    return this.#loadPickerLib.render({
      pending: () => html`<p>Loading Google Drive Picker ...</p>`,
      error: () => html`<p>Error Loading Google Drive Picker</p>`,
      complete: (lib: typeof google.picker) =>
        html`<em>Not yet implemented (${Object.keys(lib).length})</em>`,
    });
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
