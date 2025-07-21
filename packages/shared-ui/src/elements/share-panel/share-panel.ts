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
import {
  diffAssetReadPermissions,
  extractGoogleDriveFileId,
  findGoogleDriveAssetsInGraph,
  isManagedAsset,
  permissionMatchesAnyOf,
  type GoogleDriveAsset,
} from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import {
  NarrowedDriveFile,
  type GoogleDriveClient,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { type GraphDescriptor } from "@breadboard-ai/types";
import type { DomainConfiguration } from "@breadboard-ai/types/deployment-configuration.js";
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
  globalConfigContext,
  type GlobalConfig,
} from "../../contexts/global-config.js";
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
      shareableFile: { id: string };
    }
  | {
      status: "unmanaged-assets";
      problems: UnmanagedAssetProblem[];
      oldState: State;
      closed: { promise: Promise<void>; resolve: () => void };
    };

type UnmanagedAssetProblem = {
  asset: NarrowedDriveFile<"id" | "name" | "iconLink">;
} & (
  | { problem: "cant-share" }
  | { problem: "missing"; missing: gapi.client.drive.Permission[] }
);

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
      #disallowed-publishing-notice {
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        text-align: right;
        color: var(--bb-notify-500);
        max-width: 360px;
        align-self: flex-end;
        margin-top: var(--bb-grid-size-3);
        > a,
        > a:visited {
          color: var(--bb-ui-600);
          &:hover {
            color: var(--bb-ui-400);
          }
        }
        > .g-icon {
          vertical-align: middle;
          margin: 0 4px 2px 0;
        }
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

      #unmanaged-assets {
        p {
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          margin: var(--bb-grid-size-7) 0 var(--bb-grid-size) 0;
          &:first-of-type {
            margin-top: var(--bb-grid-size-5);
          }
        }

        #asset-chips {
          .asset-chip {
            background: #fceee9;
            padding: var(--bb-grid-size) var(--bb-grid-size-2);
            border-radius: var(--bb-grid-size-3);
            margin: var(--bb-grid-size-3) var(--bb-grid-size-3) 0 0;
            display: inline-block;
            font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
            a,
            a:visited {
              text-decoration: none;
              color: inherit;
            }
            img {
              filter: grayscale();
              vertical-align: middle;
              margin: 0 6px 2px 0;
            }
          }
        }

        #unmanaged-asset-buttons {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          margin-top: var(--bb-grid-size-6);
          flex: 1;
          button {
            margin-left: var(--bb-grid-size-3);
          }
          .bb-button-text {
            color: #000;
          }
          .bb-button-filled {
            background: #000;
            color: #fff;
          }
        }
      }
    `,
  ];

  @consume({ context: globalConfigContext })
  @property({ attribute: false })
  accessor globalConfig: GlobalConfig | undefined;

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
    if (status === "unmanaged-assets") {
      return this.#renderUnmanagedAssetsModalContents();
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
    return undefined;
  }

  get #isStale(): boolean | undefined {
    const state = this.#state;
    const { status } = state;
    if (status === "writable" || status === "updating") {
      return state.shareableFile?.stale ?? false;
    }
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
      this.#renderDisallowedPublishingNotice(),
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
      this.#handleAssetPermissions(oldState.shareableFile.id),
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

  #renderDisallowedPublishingNotice() {
    const {
      domain,
      config: { disallowPublicPublishing, preferredUrl },
    } = this.#userDomain;
    if (!disallowPublicPublishing) {
      return nothing;
    }
    return html`
      <p id="disallowed-publishing-notice">
        <span class="g-icon">info</span>
        Publishing is disabled for all users from ${domain}.
        <br />
        ${preferredUrl
          ? html`Please use
              <a href="${preferredUrl}" target="_blank"
                >${new URL(preferredUrl).hostname}</a
              >
              to share with other ${domain} users.`
          : nothing}
      </p>
    `;
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
        >, unpublish anytime by clicking the 'Publish' button within this
        ${APP_NAME} app and change the publish toggle. All created and remixed
        ${APP_NAME} apps will be saved in your Drive.
      </p>
    `;
  }

  #renderPublishedSwitch() {
    const { status } = this.#state;
    const published =
      (status === "writable" || status === "updating") && this.#state.published;
    const disabled =
      this.#userDomain.config.disallowPublicPublishing || status === "updating";
    return html`
      <div id="published-switch-container">
        <md-switch
          ${ref(this.#publishedSwitch)}
          ?selected=${published}
          ?disabled=${disabled}
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
        .fileIds=${[this.#state.shareableFile.id]}
        @close=${this.#onGoogleDriveSharePanelClose}
      ></bb-google-drive-share-panel>
    `;
  }

  #renderUnmanagedAssetsModalContents() {
    const state = this.#state;
    if (state.status !== "unmanaged-assets") {
      return nothing;
    }

    const parts = [];

    const missingProblems = state.problems.filter(
      ({ problem }) => problem === "missing"
    );
    if (missingProblems.length > 0) {
      const missingChips = missingProblems.map(({ asset }) => {
        const url = `https://drive.google.com/open?id=${encodeURIComponent(asset.id)}`;
        return html`
          <span class="asset-chip">
            <img src=${asset.iconLink} />
            <a href=${url} target="_blank">${asset.name}</a>
          </span>
        `;
      });
      parts.push(html`
        <p>
          The following assets are owned by you, but are not yet shared with all
          users of this app. To share them now, choose "Share my assets".
        </p>
        <div id="asset-chips">${missingChips}</div>
      `);
    }

    const cantShareProblems = state.problems.filter(
      ({ problem }) => problem === "cant-share"
    );
    if (cantShareProblems.length > 0) {
      const cantShareChips = cantShareProblems.map(({ asset }) => {
        const url = `https://drive.google.com/open?id=${encodeURIComponent(asset.id)}`;
        return html`
          <span class="asset-chip">
            <img src=${asset.iconLink} />
            <a href=${url} target="_blank">${asset.name}</a>
          </span>
        `;
      });
      parts.push(html`
        <p>
          The following assets are <strong>not</strong> owned by you, and we
          unable to verify whether they are shared with all users of this app.
          If you believe the assets are shared (e.g. they are public), you may
          safely ignore this warning. If you are unsure, contact the owner of
          the asset, or replace it with an asset you do own.
        </p>
        <div id="asset-chips">${cantShareChips}</div>
      `);
    }

    if (missingProblems.length > 0) {
      parts.push(html`
        <div id="unmanaged-asset-buttons">
          <button
            class="bb-button-text"
            @click=${this.#onClickDismissUnmanagedAssetProblems}
          >
            Ignore
          </button>
          <button
            id="share-unmanaged-assets-button"
            class="bb-button-filled"
            @click=${this.#onClickFixUnmanagedAssetProblems}
          >
            Share my assets
          </button>
        </div>
      `);
    } else {
      parts.push(html`
        <div id="unmanaged-asset-buttons">
          <button
            class="bb-button-filled"
            @click=${this.#onClickDismissUnmanagedAssetProblems}
          >
            I understand
          </button>
        </div>
      `);
    }
    return html`<div id="unmanaged-assets">${parts}</div>`;
  }

  async #onClickDismissUnmanagedAssetProblems() {
    const state = this.#state;
    if (state.status !== "unmanaged-assets") {
      return;
    }
    state.closed.resolve();
  }

  async #onClickFixUnmanagedAssetProblems() {
    const state = this.#state;
    if (state.status !== "unmanaged-assets") {
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      console.error(`No google drive client provided`);
      return;
    }
    this.#state = { status: "loading" };
    await Promise.all(
      state.problems.map(async (problem) => {
        if (problem.problem === "missing") {
          await Promise.all(
            problem.missing.map((permission) =>
              googleDriveClient.createPermission(problem.asset.id, permission, {
                sendNotificationEmail: false,
              })
            )
          );
        }
      })
    );
    state.closed.resolve();
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

    this.#state = {
      status: "granular",
      shareableFile: { id: shareableCopyFileId },
    };
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

  async #onGoogleDriveSharePanelClose() {
    if (this.#state.status !== "granular") {
      return;
    }
    const graphFileId = this.#state.shareableFile.id;
    this.#state = { status: "loading" };
    await this.#handleAssetPermissions(graphFileId);
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
    const allGraphPermissions = shareableCopyFileMetadata.permissions ?? [];
    const diff = diffAssetReadPermissions({
      actual: allGraphPermissions,
      expected: this.#getRequiredPublishPermissions(),
    });

    this.#state = {
      status: "writable",
      published: diff.missing.length === 0,
      publishedPermissions: allGraphPermissions.filter((permission) =>
        permissionMatchesAnyOf(
          permission,
          this.#getRequiredPublishPermissions()
        )
      ),
      granularlyShared:
        // We're granularly shared if there is any permission that is neither
        // one of the special publish permissions, nor the owner (since there
        // will always an owner).
        diff.excess.find((permission) => permission.role !== "owner") !==
        undefined,
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
    console.log(`[Sharing Panel] Publishing`);
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

    const graphPublishPermissions = await Promise.all(
      publishPermissions.map((permission) =>
        googleDriveClient.createPermission(
          shareableFile.id,
          { ...permission, role: "reader" },
          { sendNotificationEmail: false }
        )
      )
    );

    console.debug(
      `[Sharing] Added ${publishPermissions.length} publish` +
        ` permission(s) to shareable graph copy "${shareableFile.id}".`
    );

    await this.#handleAssetPermissions(shareableFile.id);

    this.#state = {
      status: "writable",
      published: true,
      publishedPermissions: graphPublishPermissions,
      granularlyShared: oldState.granularlyShared,
      shareableFile,
      latestVersion: newLatestVersion ?? oldState.latestVersion,
    };
  }

  async #handleAssetPermissions(graphFileId: string): Promise<void> {
    const assets = this.#getAssets();
    if (assets.length === 0) {
      return;
    }
    const managedAssets: GoogleDriveAsset[] = [];
    const unmanagedAssets: GoogleDriveAsset[] = [];
    for (const asset of this.#getAssets()) {
      if (isManagedAsset(asset)) {
        managedAssets.push(asset);
      } else {
        unmanagedAssets.push(asset);
      }
    }

    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    const graphPermissions =
      (
        await googleDriveClient.getFileMetadata(graphFileId, {
          fields: ["permissions"],
        })
      ).permissions ?? [];
    await Promise.all([
      this.#autoSyncManagedAssetPermissions(managedAssets, graphPermissions),
      this.#checkUnmanagedAssetPermissionsAndMaybePromptTheUser(
        unmanagedAssets,
        graphPermissions
      ),
    ]);
  }

  async #autoSyncManagedAssetPermissions(
    managedAssets: GoogleDriveAsset[],
    graphPermissions: gapi.client.drive.Permission[]
  ): Promise<void> {
    if (managedAssets.length === 0) {
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    await Promise.all(
      managedAssets.map(async (asset) => {
        const { capabilities, permissions: assetPermissions } =
          await googleDriveClient.getFileMetadata(asset.fileId, {
            fields: ["capabilities", "permissions"],
          });
        if (!capabilities.canShare || !assetPermissions) {
          console.error(
            `[Sharing] Could not add permission to asset ` +
              `"${asset.fileId}" because the current user does not have` +
              ` sharing capability on it. Users who don't already have` +
              ` access to this asset may not be able to run this graph.`
          );
          return;
        }
        const { missing, excess } = diffAssetReadPermissions({
          actual: assetPermissions,
          expected: graphPermissions,
        });
        if (missing.length === 0 && excess.length === 0) {
          return;
        }
        console.log(
          `[Sharing Panel] Managed asset ${asset.fileId}` +
            ` has ${missing.length} missing permission(s)` +
            ` and ${excess.length} excess permission(s). Synchronizing.`
        );
        await Promise.all([
          ...missing.map((permission) =>
            googleDriveClient.createPermission(
              asset.fileId,
              { ...permission, role: "reader" },
              { sendNotificationEmail: false }
            )
          ),
          ...excess.map((permission) =>
            googleDriveClient.deletePermission(asset.fileId, permission.id!)
          ),
        ]);
      })
    );
  }

  async #checkUnmanagedAssetPermissionsAndMaybePromptTheUser(
    unmanagedAssets: GoogleDriveAsset[],
    graphPermissions: gapi.client.drive.Permission[]
  ): Promise<void> {
    if (unmanagedAssets.length === 0) {
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      throw new Error(`No google drive client provided`);
    }
    const problems: UnmanagedAssetProblem[] = [];
    await Promise.all(
      unmanagedAssets.map(async (asset) => {
        const assetMetadata = await googleDriveClient.getFileMetadata(
          asset.fileId,
          {
            fields: ["id", "name", "iconLink", "capabilities", "permissions"],
          }
        );
        if (
          !assetMetadata.capabilities.canShare ||
          !assetMetadata.permissions
        ) {
          problems.push({ asset: assetMetadata, problem: "cant-share" });
          return;
        }
        const { missing } = diffAssetReadPermissions({
          actual: assetMetadata.permissions,
          expected: graphPermissions,
        });
        if (missing.length > 0) {
          problems.push({ asset: assetMetadata, problem: "missing", missing });
          return;
        }
      })
    );
    if (problems.length === 0) {
      return;
    }
    // TODO(aomarks) Bump es level so we can get Promise.withResolvers.
    let closed: { promise: Promise<void>; resolve: () => void };
    {
      let resolve: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      closed = { promise, resolve: resolve! };
    }
    const oldState = this.#state;
    this.#state = {
      status: "unmanaged-assets",
      problems,
      oldState,
      closed,
    };
    // Since the unmanaged asset dialog shows up in a few different flows, it's
    // useful to make it so this function waits until it has been resolved.
    // TODO(aomarks) This is a kinda weird pattern. Think about a refactor.
    await closed.promise;
    this.#state = oldState;
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

    console.debug(
      `[Sharing] Removing ${oldState.publishedPermissions.length} publish` +
        ` permission(s) from shareable graph copy "${shareableFile.id}".`
    );
    await Promise.all(
      oldState.publishedPermissions.map(async (permission) => {
        if (permission.role !== "owner") {
          await googleDriveClient.deletePermission(
            shareableFile.id,
            permission.id!
          );
        }
      })
    );

    await this.#handleAssetPermissions(shareableFile.id);

    this.#state = {
      status: "writable",
      published: false,
      granularlyShared: oldState.granularlyShared,
      shareableFile,
      latestVersion: oldState.latestVersion,
    };
  }

  get #userDomain(): { domain: string; config: DomainConfiguration } {
    const domain = this.signinAdapter?.domain;
    if (!domain) {
      return { domain: "unknown", config: {} };
    }
    return {
      domain,
      config: this.globalConfig?.domains?.[domain] ?? {},
    };
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

  #getAssets(): GoogleDriveAsset[] {
    const graph = this.graph;
    if (!graph) {
      console.error("No graph");
      return [];
    }
    return findGoogleDriveAssetsInGraph(graph);
  }

  #getRequiredPublishPermissions(): gapi.client.drive.Permission[] {
    if (!this.globalConfig) {
      console.error(`No environment was provided`);
      return [];
    }
    const permissions = this.globalConfig.googleDrive.publishPermissions;
    if (permissions.length === 0) {
      console.error(`Environment contained no googleDrive.publishPermissions`);
    }
    return permissions.map((permission) => ({ role: "reader", ...permission }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-panel": SharePanel;
  }
}
