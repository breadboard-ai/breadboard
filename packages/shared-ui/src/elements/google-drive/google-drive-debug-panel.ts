/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type TokenVendor } from "@breadboard-ai/connection-client";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { tokenVendorContext } from "../../contexts/token-vendor.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { loadDrivePicker } from "./google-apis.js";
import { createRef, ref } from "lit/directives/ref.js";

const ASSET_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
].join(",");

@customElement("bb-google-drive-debug-panel")
export class GoogleDriveDebugPanel extends LitElement {
  static styles = [
    css`
      :host {
        width: 250px;
        height: calc(100vh - 30px - 60px);
        background: #ffffffeb;
        border: 1px solid red;
        position: fixed;
        top: 60px;
        right: 30px;
        padding: 10px;
        font-size: 12px;
        overflow-y: auto;
      }
      * {
        word-break: break-all;
      }
    `,
  ];

  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @consume({ context: tokenVendorContext })
  @property({ attribute: false })
  accessor tokenVendor!: TokenVendor;

  @state()
  accessor #googleDriveBoardServer: Promise<GoogleDriveBoardServer | null> | null =
    null;

  accessor #fileIdInput = createRef<HTMLInputElement>();

  override update(changes: PropertyValues<this>) {
    super.update(changes);
    if (changes.has("tokenVendor")) {
      if (this.tokenVendor) {
        this.#googleDriveBoardServer = GoogleDriveBoardServer.from(
          "drive:",
          "Google Drive",
          { username: "", apiKey: "", secrets: new Map() },
          this.tokenVendor
        );
      } else {
        this.#googleDriveBoardServer = null;
      }
    }
  }

  override render() {
    return html`
      <h2>Google Drive Debug</h2>

      <p>Name: ${this.signinAdapter?.name}</p>

      <p>User ID: ${this.signinAdapter?.id}</p>

      <p>
        Pic:
        <img
          crossorigin="anonymous"
          src=${this.signinAdapter?.picture ?? ""}
          width="20px"
          height="20px"
        />
      </p>

      <p>Parent folder: ${until(this.#renderFolderId(), "Loading...")}</p>

      <button @click=${this.#openPickerForAnyFile}>Pick any file</button>

      <br /><br />

      <button @click=${this.#openPickerToUploadAsset}>
        Upload image asset
      </button>

      <br /><br />

      <textarea
        ${ref(this.#fileIdInput)}
        placeholder="Comma-delimited Drive file ids"
      ></textarea>
      <button @click=${this.#openPickerForSpecificFile}>
        Force pick specific files
      </button>

      <br /><br />

      <p>My projects</p>
      <ul>
        ${until(this.#renderUserBoards(), "Loading...")}
      </ul>

      <p>Projects shared with me</p>
      <ul>
        ${until(this.#renderSharedBoards(), "Loading...")}
      </ul>

      <p>Accessible image assets</p>
      <ul>
        ${until(this.#renderAssets(), "Loading...")}
      </ul>
    `;
  }

  async #renderFolderId() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const folderId = await server?.findOrCreateFolder();
    return html`
      <a
        href="https://drive.google.com/corp/drive/folders/${folderId}"
        target="_blank"
      >
        ${folderId}
      </a>
    `;
  }

  async #renderUserBoards() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const projects = await server.refreshProjects();
    return projects.map((project) => {
      const fileId = project.url.href.replace(/^drive:\//, "");
      return html` <li>${this.#renderFileLink(fileId)}</li> `;
    });
  }

  async #renderSharedBoards() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const fileIds = await server.listSharedBoards();
    return fileIds.map(
      (fileId) => html`<li>${this.#renderFileLink(fileId)}</li>`
    );
  }

  async #renderAssets() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const assets = await server.listAssets();
    return assets.map((fileId) => {
      return html`<li>${this.#renderFileLink(fileId)}</li>`;
    });
  }

  #renderFileLink(fileId: string) {
    return html`
      <a href="https://drive.google.com/file/d/${fileId}/view" target="_blank">
        ${fileId}
      </a>
    `;
  }

  async #openPickerForAnyFile() {
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      return;
    }
    const pickerLib = await loadDrivePicker();
    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");
    view.setMode(google.picker.DocsViewMode.LIST);
    // See https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .addView(view)
      .setAppId(auth.grant.client_id)
      .setOAuthToken(auth.grant.access_token)
      .setCallback((result: google.picker.ResponseObject) => {
        console.log(
          `Google Drive file is now readable: ${JSON.stringify(result)}`
        );
        this.requestUpdate();
      })
      .build();
    picker.setVisible(true);
  }

  async #openPickerForSpecificFile() {
    const fileId = this.#fileIdInput.value?.value;
    if (!fileId) {
      return;
    }
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      return;
    }
    const pickerLib = await loadDrivePicker();
    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");
    view.setFileIds(fileId);
    view.setMode(google.picker.DocsViewMode.LIST);

    // https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .addView(view)
      .setAppId(auth.grant.client_id)
      .setOAuthToken(auth.grant.access_token)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setSize(1200, 480)
      .setCallback((result: google.picker.ResponseObject) => {
        console.log(
          `Google Drive file is now readable: ${JSON.stringify(result)}`
        );
        this.requestUpdate();
      })
      .build();
    picker.setVisible(true);
  }

  async #openPickerToUploadAsset() {
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      return;
    }
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const folderId = await server?.findOrCreateFolder();
    const pickerLib = await loadDrivePicker();

    // https://developers.google.com/workspace/drive/picker/reference/picker.docsuploadview.md
    const view = new pickerLib.DocsUploadView();
    view.setParent(folderId);

    // https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .addView(view)
      .setAppId(auth.grant.client_id)
      .setSelectableMimeTypes(ASSET_MIME_TYPES)
      .setOAuthToken(auth.grant.access_token)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setSize(1200, 480)
      .setCallback((result: google.picker.ResponseObject) => {
        console.log(
          `Google Drive file is now readable: ${JSON.stringify(result)}`
        );
        this.requestUpdate();
      })
      .build();
    picker.setVisible(true);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-debug-panel": GoogleDriveDebugPanel;
  }
}
