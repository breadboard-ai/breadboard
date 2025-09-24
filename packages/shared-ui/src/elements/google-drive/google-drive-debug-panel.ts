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
import { createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { tokenVendorContext } from "../../contexts/token-vendor.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { loadDrivePicker, loadDriveShareClient } from "./google-apis.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { ok } from "@google-labs/breadboard";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { getTopLevelOrigin } from "../../utils/embed-helpers.js";
import { GRAPH_MIME_TYPE } from "@breadboard-ai/google-drive-kit/board-server/operations.js";

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

  @consume({ context: googleDriveClientContext })
  @property({ attribute: false })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  @state()
  accessor #googleDriveBoardServer: Promise<GoogleDriveBoardServer | null> | null =
    null;

  accessor #fileIdInput = createRef<HTMLInputElement>();
  accessor #emailAddressInput = createRef<HTMLInputElement>();

  override update(changes: PropertyValues<this>) {
    super.update(changes);
    if (changes.has("tokenVendor")) {
      if (this.tokenVendor && this.googleDriveClient) {
        this.#googleDriveBoardServer = GoogleDriveBoardServer.from(
          "Google Drive",
          { username: "", apiKey: "", secrets: new Map() },
          this.tokenVendor,
          this.googleDriveClient,
          [],
          import.meta.env.VITE_GOOGLE_DRIVE_USER_FOLDER_NAME || "Breadboard"
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

      <br /><br />

      <textarea
        ${ref(this.#emailAddressInput)}
        placeholder="Comma-delimited emails"
      ></textarea>

      <button @click=${this.#shareFile}>Share file</button>

      <br /><br />

      <button @click=${this.#openSharingDialog}>Open sharing dialog</button>

      <br /><br />

      <button @click=${this.#listFolderContentsInConsole}>
        List folder contents in console
      </button>

      <button @click=${this.#getFile}>Get file</button>

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
    const folderId = await server?.ops.findOrCreateFolder();
    return html`
      <a
        href="https://drive.google.com/corp/drive/folders/${folderId}"
        target="_blank"
      >
        ${folderId}
      </a>
    `;
  }

  async #renderSharedBoards() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const fileIds = await this.readSharedGraphList();
    return fileIds.map(
      (fileId) => html`<li>${this.#renderFileLink(fileId)}</li>`
    );
  }

  async #renderAssets() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const assets = await this.listAssets();
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
    const auth = await this.signinAdapter?.token();
    if (auth?.state !== "valid") {
      return;
    }
    const pickerLib = await loadDrivePicker();
    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMode(google.picker.DocsViewMode.LIST);
    view.setSelectFolderEnabled(true);
    // See https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .setOrigin(getTopLevelOrigin())
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

  async #shareFile() {
    const fileId = this.#fileIdInput.value?.value;
    const emailAddress = this.#emailAddressInput.value?.value;
    if (!fileId || !emailAddress || !this.googleDriveClient) {
      return;
    }
    const getResult = await this.googleDriveClient.getFileMetadata(fileId, {
      fields: ["capabilities", "permissions"],
    });
    if (!getResult.capabilities.canShare) {
      console.error("User is not allowed to share.");
      return;
    }
    const createResult = await this.googleDriveClient.createPermission(
      fileId,
      {
        type: "user",
        role: "reader",
        emailAddress,
      },
      {
        sendNotificationEmail: true,
      }
    );
    console.log({ createResult });
  }

  async #openPickerToUploadAsset() {
    const auth = await this.signinAdapter?.token();
    if (auth?.state !== "valid") {
      return;
    }
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const folderId = await server?.ops.findOrCreateFolder();
    if (!ok(folderId)) {
      return nothing;
    }
    const pickerLib = await loadDrivePicker();

    // https://developers.google.com/workspace/drive/picker/reference/picker.docsuploadview.md
    const view = new pickerLib.DocsUploadView();
    view.setParent(folderId);

    // https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .setOrigin(getTopLevelOrigin())
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

  async #openSharingDialog() {
    const fileIds = this.#fileIdInput.value?.value;
    if (!fileIds) {
      return;
    }
    const ShareClient = await loadDriveShareClient();
    const auth = await this.signinAdapter?.token();
    if (auth?.state !== "valid") {
      return;
    }
    const client = new ShareClient();
    client.setOAuthToken(auth.grant.access_token);
    const itemIds = fileIds.split(",");
    client.setItemIds(itemIds);
    client.showSettingsDialog();
  }

  async #listFolderContentsInConsole() {
    const folderId = this.#fileIdInput.value?.value;
    if (!folderId || !this.googleDriveClient) {
      return;
    }

    const result = await this.googleDriveClient.listFiles(
      `"${folderId}" in parents`
    );
    console.log({ result });
  }

  async #getFile() {
    const fileId = this.#fileIdInput.value?.value;
    if (!fileId) {
      return;
    }
    const result = await this.googleDriveClient!.getFileMetadata(fileId);
    console.log({ result });
  }

  async listAssets(): Promise<string[]> {
    const query = `(mimeType contains 'image/')` + ` and trashed=false`;
    const result = await this.googleDriveClient!.listFiles(query, {
      fields: ["id"],
      orderBy: [
        {
          field: "modifiedTime",
          dir: "desc",
        },
      ],
    });
    return result.files.map((file) => file.id);
  }

  async readSharedGraphList(): Promise<string[]> {
    const query =
      ` mimeType="${GRAPH_MIME_TYPE}"` +
      ` and sharedWithMe=true` +
      ` and trashed=false`;
    const response = await this.googleDriveClient!.listFiles(query, {
      fields: ["id"],
      orderBy: [
        {
          field: "modifiedTime",
          dir: "desc",
        },
      ],
    });
    return response.files.map((file) => file.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-debug-panel": GoogleDriveDebugPanel;
  }
}
