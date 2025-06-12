/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { type GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import "@material/web/switch/switch.js";
import { type MdSwitch } from "@material/web/switch/switch.js";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import animations from "../../app-templates/shared/styles/animations.js";
import {
  environmentContext,
  type Environment,
  type GoogleDrivePermission,
} from "../../contexts/environment.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { ToastEvent, ToastType } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { icons } from "../../styles/icons.js";
import { ActionTracker } from "../../utils/action-tracker.js";
import {
  signinAdapterContext,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { type GoogleDriveSharePanel } from "../elements.js";
import { findGoogleDriveAssetsInGraph } from "../google-drive/find-google-drive-assets-in-graph.js";
import { loadDriveApi } from "../google-drive/google-apis.js";
import { buttonStyles } from "../../styles/button.js";

const APP_NAME = StringsHelper.forSection("Global").from("APP_NAME");
const Strings = StringsHelper.forSection("UIController");

type PublishState =
  | { status: "initial" }
  | { status: "loading" }
  | {
      status: "written";
      published: true;
      writable: true;
      relevantPermissions: gapi.client.drive.Permission[];
    }
  | {
      status: "written";
      published: false;
      writable: true;
    }
  | {
      status: "written";
      published: boolean;
      writable: false;
    }
  | {
      status: "writing";
      published: boolean;
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
        /* Slight vertical centering adjustment because of header. */
        margin-top: -24px;
        .g-icon {
          animation: rotate 1s linear infinite;
          color: var(--bb-ui-600);
          vertical-align: middle;
          margin-right: var(--bb-grid-size-2);
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

  @property({ attribute: false })
  accessor graph: GraphDescriptor | undefined;

  @state()
  accessor #status: "closed" | "open" | "granular" = "closed";

  @state()
  accessor #publishState: PublishState = { status: "initial" };

  #dialog = createRef<HTMLDialogElement>();
  #publishedSwitch = createRef<MdSwitch>();
  #googleDriveSharePanel = createRef<GoogleDriveSharePanel>();

  override willUpdate(changes: PropertyValues<this>) {
    super.willUpdate(changes);
    if (changes.has("graph")) {
      this.#publishState = { status: "initial" };
    }
  }

  override render() {
    if (this.#status === "closed") {
      return nothing;
    } else if (this.#status === "open") {
      return this.#renderModal();
    } else if (this.#status === "granular") {
      return this.#renderGranularSharingModal();
    }
    console.error(
      `Unknown status ${JSON.stringify(this.#status satisfies never)}`
    );
    return nothing;
  }

  override updated() {
    if (this.#status === "open") {
      this.#dialog.value?.showModal();
      if (this.#publishState.status === "initial") {
        this.#readPublishedState();
      }
    } else if (this.#status === "granular") {
      this.#googleDriveSharePanel.value?.open();
    }
  }

  open(): void {
    this.#status = "open";
  }

  close(): void {
    this.#status = "closed";
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

        ${this.#publishState.status === "loading"
          ? this.#renderLoading()
          : this.#renderLoaded()}
      </dialog>
    `;
  }

  #renderLoading() {
    return html`
      <div id="loading">
        <span class="g-icon">progress_activity</span>
        Loading ...
      </div>
    `;
  }

  #renderLoaded() {
    return [
      html`
        <div id="permissions">
          Publish your ${APP_NAME} ${this.#renderPublishedSwitch()}
        </div>
      `,
      this.#renderAppLink(),
      this.#renderGranularSharingLink(),
      this.#renderAdvisory(),
    ];
  }

  #renderGranularSharingLink() {
    return html`
      <a
        id="granular-sharing-link"
        href=""
        @click=${this.#onClickViewPermissions}
      >
        View Share Permissions
      </a>
    `;
  }

  #renderAdvisory() {
    return html`<p id="advisory">
      Public links can be reshared and will reflect subsequent changes to the
      ${APP_NAME} app. Share
      <a
        href="https://policies.google.com/terms/generative-ai/use-policy"
        target="_blank"
        >responsibly</a
      >, unpublish anytime by clicking the 'share app' button within this
      ${APP_NAME} app and change the publish toggle.
    </p>`;
  }

  #renderPublishedSwitch() {
    const status = this.#publishState.status;
    if (status !== "written" && status !== "writing") {
      return nothing;
    }
    const published = this.#publishState.published;
    const writable = status === "written" && this.#publishState.writable;
    return html`
      <div id="published-switch-container">
        <md-switch
          ${ref(this.#publishedSwitch)}
          ?selected=${published}
          ?disabled=${!writable}
          @change=${this.#onPublishedSwitchChange}
        ></md-switch>
        <label for="publishedSwitch">
          ${published ? "Published" : "Private"}
        </label>
      </div>
    `;
  }

  #renderAppLink() {
    const appUrl = this.#makeAppUrl();
    if (!appUrl) {
      console.error("No app url");
      return nothing;
    }
    const published =
      this.#publishState.status === "written" && this.#publishState.published;
    if (!published) {
      return nothing;
    }
    return html`
      <div id="app-link">
        <input
          id="app-link-text"
          type="text"
          value=${published ? appUrl : ""}
          @click=${this.#onClickLinkText}
        />
        <button
          id="app-link-copy-button"
          class="bb-button-outlined"
          @click=${this.#onClickCopyLinkButton}
          ?disabled=${!published}
        >
          <span class="g-icon">link</span>
          Copy link
        </button>
      </div>
    `;
  }

  #renderGranularSharingModal() {
    return html`
      <bb-google-drive-share-panel
        ${ref(this.#googleDriveSharePanel)}
        .graph=${this.graph}
        @close=${this.#onGoogleDriveSharePanelClose}
      ></bb-google-drive-share-panel>
    `;
  }

  #onClickViewPermissions(event: MouseEvent) {
    event.preventDefault();
    this.#status = "granular";
  }

  #onPublishedSwitchChange() {
    const input = this.#publishedSwitch.value;
    if (!input) {
      console.error("Expected input element to be rendered");
      return;
    }
    const selected = input.selected;
    if (selected) {
      ActionTracker.publishApp(this.graph?.url);
      this.#publish();
    } else {
      this.#unpublish();
    }
  }

  async #onClickLinkText(event: MouseEvent & { target: HTMLInputElement }) {
    event.target.select();
  }

  async #onClickCopyLinkButton() {
    const appUrl = this.#makeAppUrl();
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

  #makeAppUrl(): string | undefined {
    const graphUrl = this.graph?.url;
    if (!graphUrl) {
      console.error("No graph URL");
      return undefined;
    }
    return new URL(`/app/${encodeURIComponent(graphUrl)}`, window.location.href)
      .href;
  }

  #onGoogleDriveSharePanelClose() {
    // The user might have changed something that would affect the published
    // state while they were in the Drive sharing modal, so we should reset.
    this.#publishState = { status: "initial" };
    this.open();
  }

  async #readPublishedState(): Promise<void> {
    const publishPermissions = this.#getPublishPermissions();
    if (publishPermissions.length === 0) {
      return undefined;
    }
    const graphFileId = this.#getGraphFileId();
    if (!graphFileId) {
      return undefined;
    }
    if (!this.googleDriveClient) {
      console.error(`No google drive client provided`);
      return undefined;
    }

    // This prevents Lit from throwing its warning about properties being
    // updated while another action was in progress.
    await Promise.resolve();
    this.#publishState = { status: "loading" };

    const fileMetadata = await this.googleDriveClient.getFileMetadata(
      graphFileId,
      { fields: ["permissions", "owners"] }
    );

    const missingRequiredPermissions = new Set(
      publishPermissions.map(stringifyPermission)
    );
    const relevantPermissions = [];
    for (const permission of fileMetadata.permissions ?? []) {
      if (missingRequiredPermissions.delete(stringifyPermission(permission))) {
        relevantPermissions.push(permission);
      }
    }
    // TODO(aomarks) We aren't checking whether assets are published here, only
    // the main graph. We should check those too, an probably have another state
    // to represent this "partially published" situation clearly (see also
    // b/415305356).
    const published =
      // If we couldn't read permissions, then assume it is published (because
      // that means we are not the owner, yet we are here looking at the file,
      // so it must be either published or granularly shared).
      fileMetadata.permissions === undefined
        ? true
        : missingRequiredPermissions.size === 0;
    const currentUserIsOwner =
      fileMetadata.owners.find((owner) => owner.me) !== undefined;

    this.#publishState = {
      status: "written",
      published,
      writable: currentUserIsOwner,
      relevantPermissions,
    };
  }

  async #publish() {
    const publishPermissions = this.#getPublishPermissions();
    if (publishPermissions.length === 0) {
      return undefined;
    }
    if (this.#publishState.status !== "written") {
      console.error('Expected published status to be "written"');
      return;
    }
    if (this.#publishState.published === true) {
      return;
    }
    const graphFileId = this.#getGraphFileId();
    if (!graphFileId) {
      return;
    }
    const oldPublishState = this.#publishState;
    this.#publishState = { status: "writing", published: true };
    const [accessToken, drive] = await Promise.all([
      this.#getAccessToken(),
      loadDriveApi(),
    ]);
    if (!accessToken) {
      this.#publishState = oldPublishState;
      return;
    }

    const graphPublishResponsesPromise = Promise.all(
      publishPermissions.map((permission) =>
        drive.permissions.create({
          access_token: accessToken,
          fileId: graphFileId,
          resource: { ...permission, role: "reader" },
          sendNotificationEmail: false,
        })
      )
    );

    // TODO(aomarks) Note we aren't including these responses in
    // relevantPermissions, so if the user decides to unpublish in the future,
    // the assets will remain published. This is a little bit subtle to get
    // right, because what if the asset was _already_ public before they added
    // it to the graph? We wouldn't want to mess with those permissions. So, we
    // may need to keep track in the BGL file of which permissions we actually
    // needed to add.
    const assetPromises = [];
    for (const assetFileId of this.#getAssetFileIds()) {
      for (const permission of publishPermissions) {
        assetPromises.push(
          drive.permissions.create({
            access_token: accessToken,
            fileId: assetFileId,
            resource: { ...permission, role: "reader" },
            sendNotificationEmail: false,
          })
        );
      }
    }
    await Promise.all(assetPromises);

    const graphPublishResponses = await graphPublishResponsesPromise;
    const relevantPermissions = graphPublishResponses.map(
      (response) => JSON.parse(response.body) as GoogleDrivePermission
    );

    this.#publishState = {
      status: "written",
      published: true,
      writable: true,
      relevantPermissions,
    };
  }

  async #unpublish() {
    if (
      this.#publishState.status !== "written" ||
      !this.#publishState.writable
    ) {
      console.error('Expected published status to be "written" and "writable"');
      return;
    }
    if (this.#publishState.published === false) {
      return;
    }
    const graphFileId = this.#getGraphFileId();
    if (!graphFileId) {
      return;
    }
    const oldPublishState = this.#publishState;
    this.#publishState = { status: "writing", published: false };
    const [accessToken, drive] = await Promise.all([
      this.#getAccessToken(),
      loadDriveApi(),
    ]);
    if (!accessToken) {
      this.#publishState = oldPublishState;
      return;
    }

    await Promise.all(
      oldPublishState.relevantPermissions.map((permission) =>
        drive.permissions.delete({
          access_token: accessToken,
          fileId: graphFileId,
          permissionId: permission.id!,
        })
      )
    );
    this.#publishState = {
      status: "written",
      published: false,
      writable: true,
    };
  }

  async #getAccessToken(): Promise<string> {
    if (!this.signinAdapter) {
      console.error(`No signinAdapter was provided`);
      return "";
    }
    const auth = await this.signinAdapter.refresh();
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

  #getPublishPermissions(): gapi.client.drive.Permission[] {
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
