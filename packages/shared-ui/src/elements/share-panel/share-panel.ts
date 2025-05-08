/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import {
  environmentContext,
  type GoogleDrivePermission,
  type Environment,
} from "../../contexts/environment.js";
import { icons } from "../../styles/icons.js";
import {
  signinAdapterContext,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { type GoogleDriveSharePanel } from "../elements.js";
import { loadDriveApi } from "../google-drive/google-apis.js";

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

        /* Match the width and backdrop of the Google Drive sharing panel, whose
           style we don't control, and which will replace our own dialog if the
           user clicks "View permissions". */
        width: 512px;
        box-sizing: border-box;
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
        /* Our default icon weight is too thin. */
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
      }

      #permissions {
        display: flex;
        justify-content: space-between;
        margin-top: var(--bb-grid-size-4);
      }
      #viewPermissionsButton {
        text-decoration: none;
        color: inherit;
        &:hover {
          text-decoration: underline;
        }
      }
      #publishedToggle {
        input,
        label {
          cursor: pointer;
        }
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
  #publishedToggleInput = createRef<HTMLInputElement>();
  #googleDriveSharePanel = createRef<GoogleDriveSharePanel>();

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

        <div id="permissions">
          <a
            id="viewPermissionsButton"
            href=""
            @click=${this.#onClickViewPermissions}
          >
            View permissions
          </a>
          ${this.#renderPublishedToggle()}
        </div>
      </dialog>
    `;
  }

  #renderPublishedToggle() {
    const status = this.#publishState.status;
    if (status === "initial" || status === "reading") {
      return html`<p>Checking ...</p>`;
    }

    status satisfies "written" | "writing";
    const published = this.#publishState.published;
    return html`
      <div id="publishedToggle">
        <input
          ${ref(this.#publishedToggleInput)}
          id="publishedToggleInput"
          type="checkbox"
          ?checked=${published}
          ?disabled=${status === "writing"}
          @change=${this.#onPublishedToggleChange}
        />
        <label for="publishedToggleInput">
          ${status === "written"
            ? published
              ? "Published"
              : "Private"
            : published
              ? "Publishing ..."
              : "Unpublishing ..."}
        </label>
      </div>
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

  #onPublishedToggleChange() {
    const input = this.#publishedToggleInput.value;
    if (!input) {
      console.error("Expected input element to be rendered");
      return;
    }
    const checked = input.checked;
    if (checked) {
      this.#publish();
    } else {
      this.#unpublish();
    }
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

    this.#publishState = { status: "reading" };

    const drive = await loadDriveApi();
    const response = await drive.permissions.list({ fileId, fields: "*" });
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
    const oldPublished = this.#publishState;
    this.#publishState = { status: "writing", published: true };
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      console.error(`Expected valid auth, got "${auth?.state}"`);
      this.#publishState = oldPublished;
      return;
    }
    const drive = await loadDriveApi();
    const responses = await Promise.all(
      publishPermissions.map((permission) =>
        drive.permissions.create({
          access_token: auth.grant.access_token,
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
    const oldPublished = this.#publishState;
    this.#publishState = { status: "writing", published: false };
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      console.error(`Expected valid auth, got "${auth?.state}"`);
      this.#publishState = oldPublished;
      return;
    }
    const drive = await loadDriveApi();
    await Promise.all(
      oldPublished.relevantPermissions.map((permission) =>
        drive.permissions.delete({
          access_token: auth.grant.access_token,
          fileId,
          permissionId: permission.id,
        })
      )
    );
    this.#publishState = { status: "written", published: false };
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
