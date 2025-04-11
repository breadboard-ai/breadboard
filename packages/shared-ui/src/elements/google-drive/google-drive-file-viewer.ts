/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type InputEnterEvent } from "../../events/events.js";
import "../connection/connection-input.js";
import { loadDriveApi, loadGapiClient } from "./google-apis.js";
import { until } from "lit/directives/until.js";

@customElement("bb-google-drive-file-viewer")
export class GoogleDriveFileViewer extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bb-neutral-50);
      padding: var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .loading {
      padding-left: var(--bb-grid-size-8);
      background: url(/images/progress-neutral.svg) 0 center / 20px 20px
        no-repeat;
    }

    img {
      max-width: 100%;
      border-radius: var(--bb-grid-size);
    }
  `;

  @state()
  private accessor _authorization:
    | { clientId: string; secret: string; expiresIn?: number }
    | undefined = undefined;

  @property()
  accessor fileUri: string | null = null;

  @property()
  accessor mimeType: string | null = null;

  @property()
  accessor connectionName = "$sign-in";

  #picker?: google.picker.Picker;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
  }

  override render() {
    if (this._authorization === undefined) {
      return html`<bb-connection-input
        @bbinputenter=${this.#onToken}
        connectionId=${this.connectionName}
      ></bb-connection-input>`;
    }

    if (!this.fileUri) {
      return html`No file set`;
    }

    const driveFile = loadGapiClient()
      .then(() => {
        if (!this._authorization) {
          return;
        }
        gapi.auth.setToken({
          access_token: this._authorization.secret,
          error: "",
          expires_in: `${this._authorization.expiresIn ?? 3600}`,
          state: "https://www.googleapis.com/auth/drive",
        });
      })
      .then(() => {
        return loadDriveApi();
      })
      .then((drive) => {
        if (!this.fileUri) {
          return null;
        }

        return drive.files.get({
          fileId: this.fileUri,
          fields: "*",
        });
      })
      .then((item) => {
        if (!item) {
          return html`Unable to find Google Drive document`;
        }

        if (item.result.hasThumbnail) {
          return html`<a href="${item.result.webViewLink}" target="_blank"
            ><img
              cross-origin
              src=${item.result.thumbnailLink}
              alt="${item.result.title ??
              // @ts-expect-error GDocs type error.
              item.result.name ??
              "Google Document"}"
          /></a>`;
        } else {
          return html`<a href="${item.result.webViewLink}" target="_blank"
            ><img
              cross-origin
              src=${item.result.iconLink}
              alt="${item.result.title ??
              // @ts-expect-error GDocs type error.
              item.result.name ??
              "Google Document"}"
          /></a>`;
        }
      });

    return html`${until(
      driveFile,
      html`<div class="loading">Loading Google Drive file...</div>`
    )}`;
  }

  #onToken(event: InputEnterEvent) {
    // Prevent ui-controller from receiving an unexpected bbinputenter event.
    //
    // TODO(aomarks) Let's not re-use bbinputenter here, we should instead use
    // bbtokengranted, but there is a small bit of refactoring necessary for
    // that to work.
    event.stopImmediatePropagation();
    const { clientId, secret, expiresIn } = event.data as {
      clientId?: string;
      secret?: string;
      expiresIn?: number;
    };
    if (clientId && secret) {
      this._authorization = { clientId, secret, expiresIn };
    }
  }
}
