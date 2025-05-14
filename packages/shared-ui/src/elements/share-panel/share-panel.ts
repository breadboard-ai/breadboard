/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import "@material/web/switch/switch.js";
import { type MdSwitch } from "@material/web/switch/switch.js";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import {
  environmentContext,
  type Environment,
  type GoogleDrivePermission,
} from "../../contexts/environment.js";
import { ToastEvent, ToastType } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { icons } from "../../styles/icons.js";
import {
  signinAdapterContext,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { type GoogleDriveSharePanel } from "../elements.js";
import { loadDriveApi } from "../google-drive/google-apis.js";

const Strings = StringsHelper.forSection("UIController");

@customElement("bb-share-panel")
export class SharePanel extends LitElement {
  static styles = [
    icons,
    css`
      :host {
        display: contents;
      }

      dialog {
        border-radius: var(--bb-grid-size-2);
        border: none;
        box-shadow:
          0px 4px 8px 3px rgba(0, 0, 0, 0.15),
          0px 1px 3px 0px rgba(0, 0, 0, 0.3);
        font-family: var(--bb-font-family);
        padding: var(--bb-grid-size-5);
        width: 420px;
        min-height: 240px;

        /* Match the backdrop of the Google Drive sharing panel, whose style we
           don't (easily) control, and which will replace our own dialog if the
           user clicks "View permissions". */
        &::backdrop {
          background-color: #fff;
          opacity: 50%;
        }
      }

      header {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--bb-grid-size-4);
      }
      h2 {
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        margin-top: 0;
      }
      #closeButton {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        font-size: 24px;
      }

      #helpText {
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
      }

      #permissions {
        display: flex;
        justify-content: space-between;
        margin-top: var(--bb-grid-size-4);
        min-height: 24px;
      }
      #viewPermissionsButton {
        text-decoration: none;
        color: inherit;
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        &:hover {
          text-decoration: underline;
        }
      }
      #loading {
        display: inline-block;
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        margin: 0;
      }
      #publishedSwitchContainer {
        display: flex;
        align-items: center;
        md-switch {
          --md-switch-track-width: 40px;
          --md-switch-track-height: 24px;
          --md-switch-selected-handle-width: 20px;
          --md-switch-selected-handle-height: 20px;
          --md-sys-color-primary: var(--bb-ui-500);
          --md-sys-color-primary-container: var(--bb-ui-50);
          --md-sys-color-surface: var(--bb-neutral-400);
          --md-sys-color-surface-container-highest: var(--bb-neutral-50);
          --md-sys-color-outline: var(--bb-neutral-600);
          &[disabled] {
            cursor: wait;
          }
        }
        label {
          display: inline-block;
          width: 3.1em;
          margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
        }
      }

      #appPanel {
        background: var(--bb-neutral-10);
        border-radius: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-top: var(--bb-grid-size-3);
        #appIcon {
          box-sizing: border-box;
          height: 60px;
          width: 60px;
          background-color: #2f6bb2;
          border: 1.5px solid #586069;
          border-radius: var(--bb-grid-size-3);
        }
        #titleAndCreator {
          margin-left: var(--bb-grid-size-4);
          #title {
            color: var(--bb-neutral-900);
            font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
              var(--bb-font-family);
            margin: 0;
          }
          #creator {
            font: 400 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
            margin: var(--bb-grid-size) 0 0 0;
            color: var(--bb-neutral-600);
          }
        }
        #copyLinkButton {
          margin-left: auto;
          padding: 6px 12px;
          background: none;
          display: flex;
          align-items: center;
          border: 1px solid var(--bb-neutral-700);
          border-radius: 20px;
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-700);
          cursor: pointer;

          &[disabled] {
            opacity: 50%;
            cursor: wait;
          }

          &:hover:not([disabled]) {
            background: var(--bb-neutral-50);
          }

          .g-icon {
            margin-right: var(--bb-grid-size);
            color: var(--bb-neutral-700);
          }
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

  @property({ attribute: false })
  accessor graph: GraphDescriptor | undefined;

  @state()
  accessor #status: "closed" | "open" | "drive-share" = "closed";

  @state()
  accessor #publishState:
    | { status: "initial" }
    | { status: "reading" }
    | {
        status: "written";
        published: true;
        relevantPermissions: GoogleDrivePermission[];
      }
    | {
        status: "written";
        published: false;
      }
    | {
        status: "writing";
        published: boolean;
      } = { status: "initial" };

  #dialog = createRef<HTMLDialogElement>();
  #publishedSwitch = createRef<MdSwitch>();
  #googleDriveSharePanel = createRef<GoogleDriveSharePanel>();

  override update(changes: PropertyValues<this>) {
    super.update(changes);
    if (changes.has("graph")) {
      this.#publishState = { status: "initial" };
    }
  }

  override render() {
    if (this.#status === "closed") {
      return nothing;
    } else if (this.#status === "open") {
      return this.#renderOpen();
    } else if (this.#status === "drive-share") {
      return this.#renderDriveShare();
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
    } else if (this.#status === "drive-share") {
      this.#googleDriveSharePanel.value?.open();
    }
  }

  open(): void {
    this.#status = "open";
  }

  close(): void {
    this.#status = "closed";
  }

  #renderOpen() {
    return html`
      <dialog ${ref(this.#dialog)} @close=${this.close}>
        <header>
          <h2>Share</h2>
          <button
            id="closeButton"
            class="g-icon"
            aria-label="Close"
            @click=${this.close}
          >
            close
          </button>
        </header>

        <p id="helpText">Please make this public to access share link</p>

        <div id="permissions">
          <a
            id="viewPermissionsButton"
            href=""
            @click=${this.#onClickViewPermissions}
          >
            View permissions
          </a>
          ${this.#renderPublishedSwitch()}
        </div>

        ${this.#renderAppPanel()}
      </dialog>
    `;
  }

  #renderPublishedSwitch() {
    const status = this.#publishState.status;
    if (status === "initial" || status === "reading") {
      return html`<p id="loading">Loading ...</p>`;
    }

    status satisfies "written" | "writing";
    const published = this.#publishState.published;
    return html`
      <div id="publishedSwitchContainer">
        <md-switch
          ${ref(this.#publishedSwitch)}
          ?selected=${published}
          ?disabled=${status === "writing"}
          @change=${this.#onPublishedSwitchChange}
        ></md-switch>
        <label for="publishedSwitch">
          ${published ? "Public" : "Private"}
        </label>
      </div>
    `;
  }

  #renderAppPanel() {
    return html`
      <div id="appPanel">
        <div id="appIcon"></div>
        <div id="titleAndCreator">
          <h3 id="title">${this.graph?.title}</h3>
          <p id="creator">By ${this.signinAdapter?.name ?? "Unknown User"}</p>
        </div>
        ${this.#renderCopyLinkButton()}
      </div>
    `;
  }

  #renderCopyLinkButton() {
    const { status } = this.#publishState;
    const published =
      (status === "written" || status === "writing") &&
      this.#publishState.published;
    if (!published) {
      return nothing;
    }
    return html`
      <button
        id="copyLinkButton"
        ?disabled=${status === "writing"}
        @click=${this.#onClickCopyLinkButton}
      >
        <span class="g-icon">link</span>
        Copy link
      </button>
    `;
  }

  #renderDriveShare() {
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
    this.#status = "drive-share";
  }

  #onPublishedSwitchChange() {
    const input = this.#publishedSwitch.value;
    if (!input) {
      console.error("Expected input element to be rendered");
      return;
    }
    const selected = input.selected;
    if (selected) {
      this.#publish();
    } else {
      this.#unpublish();
    }
  }

  async #onClickCopyLinkButton() {
    const graphUrl = this.graph?.url;
    if (!graphUrl) {
      console.error("No graph URL");
      return nothing;
    }
    const appUrl = new URL(
      `/app/${encodeURIComponent(graphUrl)}`,
      window.location.href
    );
    await navigator.clipboard.writeText(appUrl.href);
    this.dispatchEvent(
      new ToastEvent(
        Strings.from("STATUS_COPIED_TO_CLIPBOARD"),
        ToastType.INFORMATION
      )
    );
  }

  #onGoogleDriveSharePanelClose() {
    // The user might have changed something that would affect the published
    // state while they were in the Drive sharing modal, so we should reset.
    this.#publishState = { status: "initial" };
    this.open();
  }

  async #readPublishedState(): Promise<boolean | undefined> {
    const publishPermissions = this.#getPublishPermissions();
    if (publishPermissions.length === 0) {
      return undefined;
    }
    const fileId = this.#getFileId();
    if (!fileId) {
      return undefined;
    }

    const oldPublishState = this.#publishState;
    this.#publishState = { status: "reading" };
    const [accessToken, drive] = await Promise.all([
      this.#getAccessToken(),
      loadDriveApi(),
    ]);
    if (!accessToken) {
      this.#publishState = oldPublishState;
      return;
    }

    const response = await drive.permissions.list({
      access_token: accessToken,
      fileId,
      fields: "*",
    });
    const result = JSON.parse(response.body) as {
      permissions: GoogleDrivePermission[];
    };
    const missingRequiredPermissions = new Set(
      publishPermissions.map(stringifyPermission)
    );
    const relevantPermissions = [];
    for (const permission of result.permissions) {
      if (missingRequiredPermissions.delete(stringifyPermission(permission))) {
        relevantPermissions.push(permission);
      }
    }
    const published = missingRequiredPermissions.size === 0;
    this.#publishState = {
      status: "written",
      published,
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
    const fileId = this.#getFileId();
    if (!fileId) {
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

    const responses = await Promise.all(
      publishPermissions.map((permission) =>
        drive.permissions.create({
          access_token: accessToken,
          fileId,
          resource: { ...permission, role: "reader" },
          sendNotificationEmail: false,
        })
      )
    );
    const relevantPermissions = responses.map(
      (response) => JSON.parse(response.body) as GoogleDrivePermission
    );
    this.#publishState = {
      status: "written",
      published: true,
      relevantPermissions,
    };
  }

  async #unpublish() {
    if (this.#publishState.status !== "written") {
      console.error('Expected published status to be "written"');
      return;
    }
    if (this.#publishState.published === false) {
      return;
    }
    const fileId = this.#getFileId();
    if (!fileId) {
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
          fileId,
          permissionId: permission.id,
        })
      )
    );
    this.#publishState = { status: "written", published: false };
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

  #getFileId(): string | undefined {
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
    const fileId = graphUrl.replace(/^drive:\/+/, "");
    if (!fileId) {
      console.error(`File id was empty`);
    }
    return fileId;
  }

  #getPublishPermissions(): GoogleDrivePermission[] {
    if (!this.environment) {
      console.error(`No environment was provided`);
      return [];
    }
    const permissions = this.environment.googleDrive.publishPermissions;
    if (permissions.length === 0) {
      console.error(`Environment contained no googleDrive.publishPermissions`);
    }
    return permissions;
  }
}

/**
 * Make a string from a permission object that can be used for Set membership.
 */
function stringifyPermission(permission: GoogleDrivePermission) {
  if (permission.type === "domain") {
    return `domain:${permission.domain}`;
  }
  if (permission.type === "user") {
    return `user:${permission.emailAddress}`;
  }
  permission satisfies never;
  throw new Error(
    `Unexpected permission type "${(permission as GoogleDrivePermission).type}"`
  );
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-panel": SharePanel;
  }
}
