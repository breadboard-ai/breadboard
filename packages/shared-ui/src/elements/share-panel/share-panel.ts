/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import {
  IS_SHAREABLE_COPY_PROPERTY,
  LATEST_SHARED_VERSION_PROPERTY,
  MAIN_TO_SHAREABLE_COPY_PROPERTY,
  SHAREABLE_COPY_TO_MAIN_PROPERTY,
} from "@breadboard-ai/google-drive-kit/board-server/operations.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { type GraphDescriptor } from "@breadboard-ai/types";
import { type BoardServer } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import "@material/web/switch/switch.js";
import { type MdSwitch } from "@material/web/switch/switch.js";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import animations from "../../app-templates/shared/styles/animations.js";
import { boardServerContext } from "../../contexts/board-server.js";
import {
  environmentContext,
  type Environment,
  type GoogleDrivePermission,
} from "../../contexts/environment.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { ToastEvent, ToastType } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { buttonStyles } from "../../styles/button.js";
import { icons } from "../../styles/icons.js";
import { ActionTracker } from "../../utils/action-tracker.js";
import {
  signinAdapterContext,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { type GoogleDriveSharePanel } from "../elements.js";
import { findGoogleDriveAssetsInGraph } from "../google-drive/find-google-drive-assets-in-graph.js";

const APP_NAME = StringsHelper.forSection("Global").from("APP_NAME");
const Strings = StringsHelper.forSection("UIController");

type State =
  | { status: "closed" }
  | { status: "opening" }
  | { status: "loading" }
  | {
      status: "readonly";
      shareableFile: { id: string };
    }
  | {
      status: "writable";
      published: true;
      publishedPermissions: gapi.client.drive.Permission[];
      granularlyShared: boolean;
      shareableFile: {
        id: string;
        stale: boolean;
        permissions: gapi.client.drive.Permission[];
      };
      latestVersion: string;
    }
  | {
      status: "writable";
      published: false;
      granularlyShared: boolean;
      shareableFile:
        | {
            id: string;
            stale: boolean;
            permissions: gapi.client.drive.Permission[];
          }
        | undefined;
      latestVersion: string;
    }
  | {
      status: "updating";
      published: boolean;
      granularlyShared: boolean;
      shareableFile: { id: string; stale: boolean } | undefined;
    }
  | {
      status: "granular";
      fileIds: string[];
    };

@customElement("bb-share-panel")
export class SharePanel extends LitElement {
  static styles = [
    icons,
    buttonStyles,
    animations,
    css`
      :host {
        display: contents;
      }

      dialog {
        border-radius: var(--bb-grid-size-4);
        border: none;
        box-shadow:
          0px 4px 8px 3px rgba(0, 0, 0, 0.15),
          0px 1px 3px 0px rgba(0, 0, 0, 0.3);
        font-family: var(--bb-font-family);
        padding: var(--bb-grid-size-5);
        width: 500px;
        min-height: 196px;
        display: flex;
        flex-direction: column;

        /* Match the backdrop of the Google Drive sharing panel, whose style we
           don't (easily) control, and which will replace our own dialog if the
           user clicks "View permissions". */
        &::backdrop {
          background-color: #fff;
          opacity: 50%;
        }

        & #advisory {
          color: var(--bb-neutral-700);
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          margin: var(--bb-grid-size-6) 0 0 0;

          a {
            color: var(--bb-ui-600);
          }
        }
      }

      header {
        display: flex;
        justify-content: space-between;
      }
      h2 {
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        margin: 0;
      }
      #close-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        font-size: 24px;
      }

      #loading {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        .g-icon {
          animation: rotate 1s linear infinite;
          color: var(--bb-ui-600);
          vertical-align: middle;
          margin-right: var(--bb-grid-size-2);
        }
      }

      #readonly {
        margin: auto 0 auto 0;
        #app-link {
          margin: 0;
        }
      }

      #stale {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bb-neutral-50);
        margin: var(--bb-grid-size-4) calc(-1 * var(--bb-grid-size-5)) 0
          calc(-1 * var(--bb-grid-size-5));
        padding: 0 var(--bb-grid-size-6);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);

        .g-icon {
          vertical-align: middle;
          margin-right: var(--bb-grid-size-3);
        }

        button[disabled] {
          cursor: wait;
        }
      }

      #permissions {
        display: flex;
        justify-content: space-between;
        margin-top: var(--bb-grid-size-8);
        min-height: 24px;
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
      }
      #granular-sharing-link {
        text-decoration: none;
        color: var(--ui-custom-o-100);
        font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        margin: var(--bb-grid-size-6) 0 0 0;

        &:hover {
          text-decoration: underline;
        }

        &[disabled] {
          opacity: 60%;
          cursor: wait;
          &:hover {
            text-decoration: none;
          }
        }
      }
      #published-switch-container {
        display: flex;
        align-items: center;
        md-switch {
          --md-switch-track-width: 40px;
          --md-switch-track-height: 24px;
          --md-switch-selected-handle-width: 20px;
          --md-switch-selected-handle-height: 20px;
          --md-sys-color-primary: var(--bb-neutral-900);
          --md-sys-color-primary-container: var(--bb-neutral-50);
          --md-sys-color-surface: var(--bb-neutral-400);
          --md-sys-color-surface-container-highest: var(--bb-neutral-50);
          --md-sys-color-outline: var(--bb-neutral-600);
          &[disabled] {
            cursor: wait;
          }
        }
        label {
          display: inline-block;
          width: 4.5em;
          margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          text-align: center;
          color: var(--bb-neutral-500);
        }
      }

      #app-link {
        display: flex;
        margin: var(--bb-grid-size-7) 0 0 0;

        #app-link-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: 1px solid var(--bb-neutral-100);
          padding: 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-2);
          font: 500 var(--bb-body-large) / var(--bb-body-line-height-large)
            var(--bb-font-family);
        }

        #app-link-copy-button {
          margin-left: var(--bb-grid-size-8);
          border-color: var(--bb-neutral-100);
          font-weight: 500;
        }
      }

      .g-icon {
        /* Our default icon weight is too thin. */
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
      }
    `,
  ];

  @consume({ context: environmentContext })
  @property({ attribute: false })
  accessor environment!: Environment;

  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  @consume({ context: boardServerContext, subscribe: true })
  accessor boardServer: BoardServer | undefined;

  @property({ attribute: false })
  accessor graph: GraphDescriptor | undefined;

  @state()
  accessor #state: State = { status: "closed" };

  #dialog = createRef<HTMLDialogElement>();
  #publishedSwitch = createRef<MdSwitch>();
  #googleDriveSharePanel = createRef<GoogleDriveSharePanel>();

  override willUpdate(changes: PropertyValues<this>) {
    super.willUpdate(changes);
    if (changes.has("graph") && this.#state.status !== "closed") {
      this.#state = { status: "opening" };
    }
    if (this.#state.status === "opening") {
      this.#readPublishedState();
    }
  }

  override render() {
    const { status } = this.#state;
    if (status === "closed" || status === "opening") {
      return nothing;
    } else if (status === "granular") {
      return this.#renderGranularSharingModal();
    } else {
      return this.#renderModal();
    }
  }

  override updated() {
    if (this.#state.status === "granular") {
      this.#googleDriveSharePanel.value?.open();
    } else if (this.#state.status !== "closed") {
      this.#dialog.value?.showModal();
    }
  }

  open(): void {
    this.#state = { status: "opening" };
  }

  close(): void {
    this.#state = { status: "closed" };
  }

  #renderModal() {
    const title = this.graph?.title;
    return html`
      <dialog ${ref(this.#dialog)} @close=${this.close}>
        <header>
          <h2>Share ${title ? `“${title}”` : ""}</h2>
          <button
            id="close-button"
            class="g-icon"
            aria-label="Close"
            @click=${this.close}
          >
            close
          </button>
        </header>

        ${this.#renderModalContents()}
      </dialog>
    `;
  }

  #renderModalContents() {
    const { status } = this.#state;
    if (status === "loading") {
      return this.#renderLoading();
    }
    if (status === "writable" || status === "updating") {
      return this.#renderModifiableModalContents();
    }
    if (status === "readonly") {
      return this.#renderReadonlyModalContents();
    }
  }

  #renderLoading() {
    return html`
      <div id="loading">
        <span class="g-icon">progress_activity</span>
        Loading ...
      </div>
    `;
  }

  get #isShared(): boolean | undefined {
    const state = this.#state;
    const { status } = state;
    if (status === "readonly") {
      // If we're readonly, then we're not the owner. And if we're not the
      // owner, and yet here we are, then it must be shared with us one way or
      // the other.
      return true;
    }
    if (status === "writable" || status === "updating") {
      return state.published || state.granularlyShared;
    }
    status satisfies "closed" | "opening" | "loading" | "granular";
    return undefined;
  }

  get #isStale(): boolean | undefined {
    const state = this.#state;
    const { status } = state;
    if (status === "writable" || status === "updating") {
      return state.shareableFile?.stale ?? false;
    }
    status satisfies "closed" | "opening" | "loading" | "granular" | "readonly";
    return undefined;
  }

  #renderModifiableModalContents() {
    return [
      this.#isStale && this.#isShared ? this.#renderStaleBanner() : nothing,
      html`
        <div id="permissions">
          Publish your ${APP_NAME} ${this.#renderPublishedSwitch()}
        </div>
      `,
      this.#isShared ? this.#renderAppLink() : nothing,
      this.#renderGranularSharingLink(),
      this.#renderAdvisory(),
    ];
  }

  #renderStaleBanner() {
    return html`
      <div id="stale">
        <p>
          <span class="g-icon">info</span>
          Your app has unpublished changes
        </p>
        <button
          class="bb-button-text"
          .disabled=${this.#state.status !== "writable"}
          @click=${this.#onClickPublishStale}
        >
          Publish
        </button>
      </div>
    `;
  }

  async #onClickPublishStale() {
    const oldState = this.#state;
    if (oldState.status !== "writable" || !oldState.shareableFile) {
      return;
    }
    if (!this.googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    if (!this.boardServer) {
      throw new Error(`No board server provided`);
    }
    if (!(this.boardServer instanceof GoogleDriveBoardServer)) {
      throw new Error(`Provided board server was not Google Drive`);
    }
    if (!this.graph) {
      throw new Error(`No graph`);
    }

    this.#state = {
      status: "updating",
      published: oldState.published,
      granularlyShared: oldState.granularlyShared,
      shareableFile: oldState.shareableFile,
    };

    const shareableFileUrl = new URL(`drive:/${oldState.shareableFile.id}`);
    const updatedShareableGraph = structuredClone(this.graph);
    delete updatedShareableGraph["url"];

    await Promise.all([
      // Update the contents of the shareable copy.
      this.boardServer.ops.writeGraphToDrive(
        shareableFileUrl,
        updatedShareableGraph
      ),
      // Update the latest version property on the main file.
      this.googleDriveClient.updateFileMetadata(oldState.shareableFile.id, {
        properties: {
          [LATEST_SHARED_VERSION_PROPERTY]: oldState.latestVersion,
        },
      }),
      // Ensure all assets have the same permissions as the shareable file,
      // since they might have been added since the last publish.
      this.#writePermissionsToShareableAssets(
        oldState.shareableFile.permissions.filter(
          (permission) => permission.role !== "owner"
        )
      ),
    ]);

    this.#state = {
      ...oldState,
      shareableFile: {
        ...oldState.shareableFile,
        stale: false,
      },
    };

    console.debug(
      `[Sharing] Updated stale shareable graph copy` +
        ` "${oldState.shareableFile.id}" to version` +
        ` "${oldState.latestVersion}".`
    );
  }

  #renderReadonlyModalContents() {
    return html`<div id="readonly">${this.#renderAppLink()}</div>`;
  }

  #renderAppLink() {
    const appUrl = this.#appUrl;
    if (!appUrl) {
      console.error("No app url");
      return nothing;
    }
    return html`
      <div id="app-link">
        <input
          id="app-link-text"
          type="text"
          value=${appUrl}
          @click=${this.#onClickLinkText}
        />
        <button
          id="app-link-copy-button"
          class="bb-button-outlined"
          @click=${this.#onClickCopyLinkButton}
        >
          <span class="g-icon">link</span>
          Copy link
        </button>
      </div>
    `;
  }

  #renderGranularSharingLink() {
    return html`
      <a
        id="granular-sharing-link"
        href=""
        @click=${this.#onClickViewSharePermissions}
        ?disabled=${this.#state.status !== "writable"}
      >
        View Share Permissions
      </a>
    `;
  }

  #renderAdvisory() {
    return html`
      <p id="advisory">
        Publishing an ${APP_NAME} app will reveal all prompts used to create the
        ${APP_NAME} app. Public links can be reshared with anyone. Share
        <a
          href="https://policies.google.com/terms/generative-ai/use-policy"
          target="_blank"
          >responsibly</a
        >, unpublish anytime by clicking the 'share app' button within this
        ${APP_NAME} app and change the publish toggle. All created and remixed
        ${APP_NAME} apps will be saved in your Drive.
      </p>
    `;
  }

  #renderPublishedSwitch() {
    const { status } = this.#state;
    const published =
      (status === "writable" || status === "updating") && this.#state.published;
    return html`
      <div id="published-switch-container">
        <md-switch
          ${ref(this.#publishedSwitch)}
          ?selected=${published}
          ?disabled=${status === "updating"}
          @change=${this.#onPublishedSwitchChange}
        ></md-switch>
        <label for="publishedSwitch">
          ${published ? "Published" : "Private"}
        </label>
      </div>
    `;
  }

  #renderGranularSharingModal() {
    if (this.#state.status !== "granular") {
      return nothing;
    }
    return html`
      <bb-google-drive-share-panel
        ${ref(this.#googleDriveSharePanel)}
        .fileIds=${this.#state.fileIds}
        @close=${this.#onGoogleDriveSharePanelClose}
      ></bb-google-drive-share-panel>
    `;
  }

  async #onClickViewSharePermissions(event: MouseEvent) {
    event.preventDefault();
    if (this.#state.status !== "writable") {
      return;
    }
    if (!this.graph?.url) {
      console.error(`No graph url`);
      return;
    }

    const oldState = this.#state;
    this.#state = { status: "loading" };

    // We must create the shareable copy now if it doesn't already exist, since
    // that's the file we need to open the granular permissions dialog with.
    const shareableCopyFileId =
      oldState.shareableFile?.id ??
      (await this.#makeShareableCopy()).shareableCopyFileId;

    const assetFileIds = findGoogleDriveAssetsInGraph(this.graph);
    if (assetFileIds.length === 0) {
      this.#state = {
        status: "granular",
        fileIds: [shareableCopyFileId],
      };
    } else {
      // The Google Drive sharing component will crash if you pass it file ids
      // that the current user can't share. So, since it's possible to upload
      // assets to a graph that you don't own/can't share, we need to filter the
      // list down to only those that are shareable.
      const { googleDriveClient } = this;
      if (!googleDriveClient) {
        console.error(`No google drive client provided`);
        return;
      }
      const shareableAssetFileIds = (
        await Promise.all(
          assetFileIds.map((fileId) =>
            googleDriveClient.getFileMetadata(fileId, {
              fields: ["id", "capabilities"],
            })
          )
        )
      )
        // TODO(aomarks) Show a warning to the user that this asset can't be
        // shared.
        .filter(({ capabilities }) => capabilities.canShare)
        .map(({ id }) => id);
      this.#state = {
        status: "granular",
        fileIds: [shareableCopyFileId, ...shareableAssetFileIds],
      };
    }
  }

  #onPublishedSwitchChange() {
    const input = this.#publishedSwitch.value;
    if (!input) {
      console.error("Expected input element to be rendered");
      return;
    }
    if (!this.graph?.url) {
      console.error("No graph url");
      return;
    }
    const selected = input.selected;
    if (selected) {
      ActionTracker.publishApp(this.graph.url);
      this.#publish();
    } else {
      this.#unpublish();
    }
  }

  async #onClickLinkText(event: MouseEvent & { target: HTMLInputElement }) {
    event.target.select();
  }

  async #onClickCopyLinkButton() {
    const appUrl = this.#appUrl;
    if (!appUrl) {
      console.error("No app url");
      return nothing;
    }
    await navigator.clipboard.writeText(appUrl);
    this.dispatchEvent(
      new ToastEvent(
        Strings.from("STATUS_COPIED_TO_CLIPBOARD"),
        ToastType.INFORMATION
      )
    );
  }

  get #appUrl(): string | undefined {
    const state = this.#state;
    if (
      (state.status === "writable" ||
        state.status === "updating" ||
        state.status === "readonly") &&
      state.shareableFile
    ) {
      return new URL(
        `/?flow=drive:/${encodeURIComponent(state.shareableFile.id)}&mode=app`,
        window.location.href
      ).href;
    }
    return undefined;
  }

  #onGoogleDriveSharePanelClose() {
    // The user might have changed something that would affect the published
    // state while they were in the Drive sharing modal, so we should reset.
    this.#state = { status: "opening" };
    this.open();
  }

  async #readPublishedState(): Promise<void> {
    const graphUrl = this.graph?.url;
    if (!graphUrl) {
      console.error(`No graph url`);
      return;
    }
    const thisFileId = this.#getGraphFileId();
    if (!thisFileId) {
      console.error(`No file id`);
      return;
    }
    if (!this.googleDriveClient) {
      console.error(`No google drive client provided`);
      return;
    }
    if (!this.boardServer) {
      console.error(`No board server provided`);
      return;
    }
    if (!(this.boardServer instanceof GoogleDriveBoardServer)) {
      console.error(`Provided board server was not Google Drive`);
      return;
    }

    this.#state = { status: "loading" };

    // Ensure any pending changes are saved so that our Drive operations will be
    // synchronized with those changes.
    await this.boardServer.flushSaveQueue(graphUrl);

    const thisFileMetadata = await this.googleDriveClient.getFileMetadata(
      thisFileId,
      { fields: ["properties", "ownedByMe", "version"] }
    );

    const thisFileIsAShareableCopy =
      thisFileMetadata.properties?.[SHAREABLE_COPY_TO_MAIN_PROPERTY] !==
      undefined;
    if (thisFileIsAShareableCopy) {
      this.#state = {
        status: "readonly",
        shareableFile: { id: thisFileId },
      };
      return;
    }

    const shareableCopyFileId =
      thisFileMetadata.properties?.[MAIN_TO_SHAREABLE_COPY_PROPERTY];

    if (!thisFileMetadata.ownedByMe) {
      this.#state = {
        status: "readonly",
        shareableFile: { id: shareableCopyFileId || thisFileId },
      };
      return;
    }

    if (!shareableCopyFileId) {
      this.#state = {
        status: "writable",
        published: false,
        granularlyShared: false,
        shareableFile: undefined,
        latestVersion: thisFileMetadata.version,
      };
      return;
    }

    const shareableCopyFileMetadata =
      await this.googleDriveClient.getFileMetadata(shareableCopyFileId, {
        fields: ["properties", "permissions"],
      });

    const shareableCopyPermissions =
      shareableCopyFileMetadata.permissions ?? [];
    const missingPublishPermissions = new Set(
      this.#getRequiredPublishPermissions().map(stringifyPermission)
    );
    const actualPublishPermissions = [];
    const actualNonPublishPermissions = [];
    for (const permission of shareableCopyPermissions) {
      if (missingPublishPermissions.delete(stringifyPermission(permission))) {
        actualPublishPermissions.push(permission);
      } else {
        actualNonPublishPermissions.push(permission);
      }
    }

    this.#state = {
      status: "writable",
      published: missingPublishPermissions.size === 0,
      publishedPermissions: actualPublishPermissions,
      granularlyShared:
        // We're granularly shared if there is any permission that is neither
        // one of the special publish permissions, nor the owner (since there
        // will always an owner).
        actualNonPublishPermissions.find(
          (permission) => permission.role !== "owner"
        ) !== undefined,
      shareableFile: {
        id: shareableCopyFileId,
        stale:
          thisFileMetadata.version !==
          shareableCopyFileMetadata.properties?.[
            LATEST_SHARED_VERSION_PROPERTY
          ],
        permissions: shareableCopyFileMetadata.permissions ?? [],
      },
      latestVersion: thisFileMetadata.version,
    };

    console.debug(
      `[Sharing] Found sharing state:` +
        ` ${JSON.stringify(this.#state, null, 2)}`
    );
  }

  async #publish() {
    const publishPermissions = this.#getRequiredPublishPermissions();
    if (publishPermissions.length === 0) {
      console.error("No publish permissions configured");
      return;
    }
    if (this.#state.status !== "writable") {
      console.error('Expected published status to be "writable"');
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      console.error(`No google drive client provided`);
      return;
    }

    if (this.#state.published) {
      // Already published!
      return;
    }

    let { shareableFile } = this.#state;
    const oldState = this.#state;
    this.#state = {
      status: "updating",
      published: true,
      granularlyShared: oldState.granularlyShared,
      shareableFile,
    };

    let newLatestVersion: string | undefined;
    if (!shareableFile) {
      const copyResult = await this.#makeShareableCopy();
      shareableFile = {
        id: copyResult.shareableCopyFileId,
        stale: false,
        permissions: publishPermissions,
      };
      newLatestVersion = copyResult.newMainVersion;
    }

    const graphPublishResponsesPromise = Promise.all(
      publishPermissions.map((permission) =>
        googleDriveClient.createPermission(
          shareableFile.id,
          { ...permission, role: "reader" },
          { sendNotificationEmail: false }
        )
      )
    );

    await this.#writePermissionsToShareableAssets(publishPermissions);

    const relevantPermissions = await graphPublishResponsesPromise;

    console.debug(
      `[Sharing] Added ${publishPermissions.length} publish` +
        ` permission(s) to shareable graph copy "${shareableFile.id}".`
    );

    this.#state = {
      status: "writable",
      published: true,
      publishedPermissions: relevantPermissions,
      granularlyShared: oldState.granularlyShared,
      shareableFile,
      latestVersion: newLatestVersion ?? oldState.latestVersion,
    };
  }

  async #writePermissionsToShareableAssets(
    permissions: gapi.client.drive.Permission[]
  ): Promise<void> {
    if (permissions.length === 0) {
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    await Promise.all(
      this.#getAssetFileIds().map(async (assetFileId) => {
        const metadata = await googleDriveClient.getFileMetadata(assetFileId, {
          fields: ["capabilities"],
        });
        if (metadata.capabilities.canShare) {
          await Promise.all(
            permissions.map((permission) =>
              googleDriveClient.createPermission(
                assetFileId,
                { ...permission, role: "reader" },
                { sendNotificationEmail: false }
              )
            )
          );
          console.debug(
            `[Sharing] Added ${permissions.length} permission(s) to asset` +
              ` "${assetFileId}".`
          );
        } else {
          // TODO(aomarks) Show a warning to the user that this asset can't be
          // shared.
          console.warn(
            `[Sharing] Could not add permission to asset ` +
              `"${assetFileId}" because the current user does not have` +
              ` sharing capability on it. Users who don't already have` +
              ` access to this asset may not be able to run this graph.`
          );
        }
      })
    );
  }

  async #unpublish() {
    if (this.#state.status !== "writable") {
      console.error('Expected published status to be "writable"');
      return;
    }
    if (!this.#state.published) {
      // Already unpublished!
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    const { shareableFile } = this.#state;
    const oldState = this.#state;
    this.#state = {
      status: "updating",
      published: false,
      granularlyShared: oldState.granularlyShared,
      shareableFile,
    };
    await Promise.all(
      oldState.publishedPermissions.map((permission) => {
        googleDriveClient.deletePermission(shareableFile.id, permission.id!);
      })
    );

    // Note we are not removing permissions from assets. That's because the
    // asset might need to remain published (maybe it's used in another graph,
    // or maybe it was already public in Drive for some other reason). Maybe
    // we should inform the user about this.

    console.debug(
      `[Sharing] Removed ${oldState.publishedPermissions.length} publish` +
        ` permission(s) from shareable graph copy "${shareableFile.id}".`
    );

    this.#state = {
      status: "writable",
      published: false,
      granularlyShared: oldState.granularlyShared,
      shareableFile,
      latestVersion: oldState.latestVersion,
    };
  }

  async #getAccessToken(): Promise<string> {
    if (!this.signinAdapter) {
      console.error(`No signinAdapter was provided`);
      return "";
    }
    const auth = await this.signinAdapter.token();
    if (auth?.state !== "valid") {
      console.error(`Expected valid auth, got "${auth?.state}"`);
      return "";
    }
    const accessToken = auth.grant.access_token;
    if (!accessToken) {
      console.error(`Access token was empty`);
    }
    return accessToken;
  }

  async #makeShareableCopy(): Promise<{
    shareableCopyFileId: string;
    newMainVersion: string;
  }> {
    if (!this.googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    if (!this.boardServer) {
      throw new Error(`No board server provided`);
    }
    if (!(this.boardServer instanceof GoogleDriveBoardServer)) {
      throw new Error(`Provided board server was not Google Drive`);
    }
    if (!this.graph) {
      throw new Error(`Graph was not provided`);
    }
    if (!this.graph.url) {
      throw new Error(`Graph had no URL`);
    }
    const mainFileId = extractGoogleDriveFileId(this.graph.url);
    if (!mainFileId) {
      throw new Error(
        `Graph URL did not contain a Google Drive file id: ${this.graph.url}`
      );
    }

    const shareableFileName = `${mainFileId}-shared.bgl.json`;
    const shareableGraph = structuredClone(this.graph);
    delete shareableGraph["url"];

    const createResult = await this.boardServer.create(
      // Oddly, the title of the file is extracted from a URL that is passed in,
      // even though URLs of this form are otherwise totally invalid.
      //
      // TODO(aomarks) This doesn't seem to actually work. The title is in fact
      // taken from the descriptor. So what is the purpose of passing a URL
      // here?
      new URL(`drive:/${shareableFileName}`),
      shareableGraph
    );
    const shareableCopyFileId = extractGoogleDriveFileId(
      createResult.url ?? ""
    );
    if (!shareableCopyFileId) {
      console.error(`Unexpected create result`, createResult);
      throw new Error(`Error creating shareable file`);
    }

    // Update the latest version property on the main file.
    const updateMainResult = await this.googleDriveClient.updateFileMetadata(
      mainFileId,
      {
        properties: {
          [MAIN_TO_SHAREABLE_COPY_PROPERTY]: shareableCopyFileId,
        },
      },
      { fields: ["version"] }
    );
    await this.googleDriveClient.updateFileMetadata(shareableCopyFileId, {
      properties: {
        [SHAREABLE_COPY_TO_MAIN_PROPERTY]: mainFileId,
        [LATEST_SHARED_VERSION_PROPERTY]: updateMainResult.version,
        [IS_SHAREABLE_COPY_PROPERTY]: "true",
      },
    });

    // TODO(aomarks) This shouldn't be necessary, but if we don't do this, the
    // copy will appear on the user's gallery page until the browser's site data
    // is cleared because of our Drive caching infrastructure. This is a quick
    // hack in lieu of understanding how to make the caching infrastructure
    // handle this case better.
    await this.boardServer.ops.refreshUserList(true);

    console.debug(
      `[Sharing] Made a new shareable graph copy "${shareableCopyFileId}"` +
        ` at version "${updateMainResult.version}".`
    );
    return {
      shareableCopyFileId,
      newMainVersion: updateMainResult.version,
    };
  }

  #getGraphFileId(): string | undefined {
    const graphUrl = this.graph?.url;
    if (!graphUrl) {
      console.error("No graph URL");
      return undefined;
    }
    if (!graphUrl.startsWith("drive:")) {
      console.error(
        `Expected "drive:" prefixed graph URL, got ${JSON.stringify(graphUrl)}`
      );
      return undefined;
    }
    const graphFileId = graphUrl.replace(/^drive:\/*/, "");
    if (!graphFileId) {
      console.error(`Graph file ID was empty`);
    }
    return graphFileId;
  }

  #getAssetFileIds(): string[] {
    const graph = this.graph;
    if (!graph) {
      console.error("No graph");
      return [];
    }
    return findGoogleDriveAssetsInGraph(graph);
  }

  #getRequiredPublishPermissions(): gapi.client.drive.Permission[] {
    if (!this.environment) {
      console.error(`No environment was provided`);
      return [];
    }
    const permissions = this.environment.googleDrive.publishPermissions;
    if (permissions.length === 0) {
      console.error(`Environment contained no googleDrive.publishPermissions`);
    }
    return permissions.map((permission) => ({ role: "reader", ...permission }));
  }
}

/**
 * Make a string from a permission object that can be used for Set membership.
 */
export function stringifyPermission(
  permission: gapi.client.drive.Permission
): string {
  if (permission.type === "user") {
    return `user:${permission.emailAddress}:${permission.role}`;
  }
  if (permission.type === "group") {
    return `group:${permission.emailAddress}:${permission.role}`;
  }
  if (permission.type === "domain") {
    return `domain:${permission.domain}:${permission.role}`;
  }
  if (permission.type === "anyone") {
    return `anyone:${permission.role}`;
  }
  // Don't throw because Google Drive could add new permission types in the
  // future, and that shouldnt be fatal. Instead return the unique ID of the
  // permission (or something random if it doesn't have an ID), so that it will
  // never be treated as equal to a different permission object (since by
  // definition, we don't know what that would mean).
  console.error(
    `Unexpected permission type "${(permission as GoogleDrivePermission).type}"`
  );
  return (
    `error` +
    `:${(permission as GoogleDrivePermission).type}` +
    `:${(permission as GoogleDrivePermission).id || Math.random()}` +
    `:${permission.role}`
  );
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-panel": SharePanel;
  }
}
