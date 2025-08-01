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
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { ok } from "@google-labs/breadboard";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { getTopLevelOrigin } from "../../utils/embed-helpers.js";
import { GRAPH_MIME_TYPE } from "@breadboard-ai/google-drive-kit/board-server/operations.js";

const Strings = BreadboardUI.Strings.forSection("Global");

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

      <button @click=${this.#openPickerForSpecificFile}>
        Force pick specific files
      </button>

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

  async #renderUserBoards() {
    const server = await this.#googleDriveBoardServer;
    if (!server) {
      return nothing;
    }
    const projects = await server.listProjects();
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

  async #openPickerForSpecificFile() {
    const fileId = this.#fileIdInput.value?.value;
    if (!fileId) {
      return;
    }
    const auth = await this.signinAdapter?.token();
    if (auth?.state !== "valid") {
      return;
    }
    const pickerLib = await loadDrivePicker();
    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");
    view.setFileIds(fileId);
    view.setMode(google.picker.DocsViewMode.GRID);
    view.setSelectFolderEnabled(true);

    const overlay = document.createElement("bb-google-drive-picker-overlay");
    const underlay = document.createElement("bb-google-drive-picker-underlay");

    // Note the resize observer is initialized later in this function, but we
    // need a reference now for the callback, so it is declared early.
    let resizeObserver: ResizeObserver | undefined = undefined;

    // https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .setOrigin(getTopLevelOrigin())
      .addView(view)
      .setAppId(auth.grant.client_id)
      .setOAuthToken(auth.grant.access_token)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setSize(1200, 480)
      .setCallback((result: google.picker.ResponseObject) => {
        if (result.action === "picked" || result.action === "cancel") {
          overlay.remove();
          underlay.remove();
          picker.dispose();
          resizeObserver?.disconnect();
          if (result.action === "picked") {
            console.log(
              `Google Drive file is now readable: ${JSON.stringify(result)}`
            );
            this.requestUpdate();
          }
        }
      })
      .build();
    picker.setVisible(true);

    let dialog, iframe;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      dialog = document.body.querySelector("div.picker-dialog" as "div");
      iframe = dialog?.querySelector("iframe.picker-frame" as "iframe");
      if (dialog && iframe) {
        break;
      }
      console.error("Could not find picker, retrying", { dialog, iframe });
      // TODO(aomarks) Give up after a while in case something went wrong.
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    // Squish the tile and buttons together vertically.
    iframe.style.height = "430px";

    // Squish the dialog to the width of a single tile.
    dialog.style.width = "225px";
    dialog.style.overflow = "hidden";

    // Remove the dialog's original background styling; we're replacing it.
    dialog.style.background = "none";
    dialog.style.border = "none";
    dialog.style.boxShadow = "none";

    // The dialog is way off-center now, but it monitors for window resize
    // events to re-position itself, so we can fake one of those.
    window.dispatchEvent(new Event("resize"));

    // Detect the dimensions of the dialog so that we can position and size
    // our underlay/overlay accordingly.
    const detectPickerSize = () => {
      const rect = dialog.getBoundingClientRect();
      for (const property of ["top", "left", "width", "height"] as const) {
        document.body.style.setProperty(
          `--google-drive-picker-${property}`,
          `${rect[property]}px`
        );
      }
    };
    detectPickerSize();
    resizeObserver = new ResizeObserver(() => detectPickerSize());
    resizeObserver.observe(dialog);
    resizeObserver.observe(document.body);

    document.body.appendChild(underlay);
    document.body.appendChild(overlay);
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

@customElement("bb-google-drive-picker-underlay")
export class GoogleDrivePickerUnderlay extends LitElement {
  static styles = [
    css`
      :host {
        position: fixed;
        /* Right below the picker. */
        z-index: 999;
        width: 100vw;
        height: calc(var(--google-drive-picker-height) - 50px);
        top: var(--google-drive-picker-top);
        left: 0;
        display: flex;
        justify-content: center;
      }
      #container {
        min-width: var(--google-drive-picker-width);
        max-width: 600px;
        width: 100%;
        background: #fff;
        border-radius: 15px;
        box-shadow: rgb(100 100 111 / 50%) 0 0 10px 3px;
        margin: 0 10px;
      }
    `,
  ];

  override render() {
    return html`<div id="container"></div>`;
  }
}

@customElement("bb-google-drive-picker-overlay")
export class GoogleDrivePickerOverlay extends LitElement {
  static styles = [
    css`
      :host {
        position: fixed;
        /* Right above the picker. */
        z-index: 1001;
        width: 100vw;
        height: 120px;
        top: calc(var(--google-drive-picker-top) + 15px);
        left: 0;
        display: flex;
        justify-content: center;
      }
      #banner {
        min-width: var(--google-drive-picker-width);
        max-width: 600px;
        background: #fff;
        font-family: var(--bb-font-family), sans-serif;
        text-align: center;
      }
      h3 {
        font-size: 20px;
        font-weight: 400;
        margin: 30px 0 0 0;
      }
      p {
        font-size: 15px;
        color: #797979;
      }
      #line-hider {
        top: calc(
          var(--google-drive-picker-top) + var(--google-drive-picker-height) -
            123px
        );
        left: var(--google-drive-picker-left);
        position: fixed;
        background: #fff;
        width: var(--google-drive-picker-width);
        height: 5px;
      }
    `,
  ];

  override render() {
    return html`
      <div id="banner">
        <h3>An ${Strings.from("APP_NAME")} has been shared with you!</h3>
        <p>To run it, choose it below and click <em>Select</em>.</p>
      </div>
      <div id="line-hider"></div>
    `;
  }
}
