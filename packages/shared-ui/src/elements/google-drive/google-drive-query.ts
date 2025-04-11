/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { InputPlugin } from "../../plugins/input-plugin.js";
import { type InputEnterEvent } from "../../events/events.js";
import "../connection/connection-input.js";
import { loadDrivePicker } from "./google-apis.js";

export const googleDriveQueryInputPlugin: InputPlugin = {
  instantiate: {
    customElementName: "bb-google-drive-query",
  },
  match: {
    schema: {
      type: "string",
      behavior: ["google-drive-query"],
    },
  },
};

@customElement("bb-google-drive-query")
export class GoogleDriveQuery extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      max-width: 400px;
    }

    #query {
      display: flex;
      flex-direction: column;
    }
    #query > textarea {
      box-sizing: border-box;
      height: 4lh;
      margin-top: 14px;
      padding: 8px;
      width: 100%;
    }
    #query > a {
      align-self: flex-end;
      color: var(--bb-ui-600);
      font-size: 11px;
      margin-top: 4px;
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
  `;

  @state()
  private accessor _authorization:
    | { clientId: string; secret: string }
    | undefined = undefined;

  @state()
  private accessor _pickerLib: typeof google.picker | undefined = undefined;

  @property()
  accessor value = "";

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
      <section id="query">
        <textarea
          placeholder="Google Drive Query"
          .value=${this.value}
          @input=${this.#onQueryInput}
        ></textarea>
        <a
          href="https://developers.google.com/drive/api/guides/search-files"
          target="_blank"
          referrerpolicy="no-referrer"
          >Syntax Documentation</a
        >
      </section>

      <section id="sharing">
        <button @click=${this.#onClickPickFiles}>Share Files</button>
        <p>
          The query above only matches files you have shared with Breadboard
          (including all previously shared files). Click to share additional
          files. Hold <kbd>Shift</kbd> for multi-select.
        </p>
      </section>
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
          `Shared ${result.docs?.length} Google Drive files with Breadboard`
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

  #onQueryInput(event: { target: HTMLTextAreaElement }) {
    this.value = event.target.value;
  }
}
