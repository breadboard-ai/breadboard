/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  onlyWritablePermissionFields,
  type GoogleDriveClient,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { buttonStyles } from "../../styles/button.js";
import { Task } from "@lit/task";

const Strings = BreadboardUI.Strings.forSection("Global");

type State =
  | { status: "closed" }
  | {
      status: "open";
      permissions: Array<[string, gapi.client.drive.Permission[]]>;
    }
  | {
      status: "applying";
      permissions: Array<[string, gapi.client.drive.Permission[]]>;
    };

@customElement("bb-google-drive-asset-share-dialog")
export class GoogleDriveAssetShareDialog extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        display: contents;
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
      }

      dialog {
        border-radius: var(--bb-grid-size-2);
        border: none;
        box-shadow:
          0px 4px 8px 3px rgba(0, 0, 0, 0.15),
          0px 1px 3px 0px rgba(0, 0, 0, 0.3);
        font-family: var(--bb-font-family);
        padding: var(--bb-grid-size-5);
      }

      h3 {
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        margin-top: 0;
      }

      #buttons {
        margin-top: var(--bb-grid-size-4);
        display: flex;
        justify-content: flex-end;
        align-items: center;
        button {
          margin-left: var(--bb-grid-size-2);
          &[disabled] {
            cursor: wait;
          }
        }
        #share-button {
          color: var(--bb-ui-700);
        }
      }
    `,
  ];

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient | undefined;

  @state()
  accessor #state: State = { status: "closed" };

  readonly #dialog = createRef<HTMLDialogElement>();

  readonly #readFileNames = new Task(this, {
    task: async ([googleDriveClient, permissions], { signal }) => {
      if (!googleDriveClient || !permissions) {
        return [];
      }
      let files;
      try {
        files = await Promise.all(
          permissions.map(([fileId]) =>
            googleDriveClient.getFile(fileId, {
              fields: ["id", "name"],
              signal,
            })
          )
        );
      } catch (e) {
        console.error(e);
        throw e;
      }
      return files.map((file) => [file.id!, file.name!] as const);
    },
    args: () => [
      this.googleDriveClient,
      this.#state.status === "closed" ? undefined : this.#state.permissions,
    ],
  });

  override render() {
    const state = this.#state;
    const { status } = state;
    if (status === "closed") {
      return nothing;
    } else if (status === "open" || status === "applying") {
      const appName = Strings.from("APP_NAME");
      const applying = status === "applying";
      return html`
        <dialog ${ref(this.#dialog)} @close=${this.close}>
          <h3>Users of this ${appName} need access to an asset</h3>

          <p>
            Click <em>Share</em> to allow everyone who can access this
            ${appName} to access:
          </p>

          <ul>
            ${this.#readFileNames.render({
              pending: () =>
                state.permissions.map(
                  ([fileId]) => html`
                    <li>
                      <a
                        href="https://drive.google.com/open?id=${encodeURIComponent(
                          fileId
                        )}"
                        target="_blank"
                        >Loading ...</a
                      >
                    </li>
                  `
                ),
              complete: (names) =>
                names.map(
                  ([fileId, fileName]) => html`
                    <li>
                      <a
                        href="https://drive.google.com/open?id=${encodeURIComponent(
                          fileId
                        )}"
                        target="_blank"
                        >${fileName}</a
                      >
                    </li>
                  `
                ),
            })}
          </ul>

          <div id="buttons">
            ${applying
              ? html`<span id="applying-message">Applying ...</span>`
              : nothing}

            <button
              id="cancel-button"
              class="bb-button-text"
              .disabled=${applying}
              @click=${this.close}
            >
              Cancel
            </button>

            <button
              id="share-button"
              class="bb-button-text"
              .disabled=${applying}
              @click=${this.#onClickShare}
            >
              Share
            </button>
          </div>
        </dialog>
      `;
    }
    console.error(`Unknown status ${JSON.stringify(status satisfies never)}`);
    return nothing;
  }

  override updated() {
    if (this.#state.status === "open") {
      this.#dialog.value?.showModal();
    }
  }

  open(permissions: Iterable<[string, gapi.client.drive.Permission[]]>) {
    this.#state = { status: "open", permissions: [...permissions] };
  }

  close() {
    this.#state = { status: "closed" };
  }

  async #onClickShare() {
    if (this.#state.status !== "open") {
      return;
    }
    if (!this.googleDriveClient) {
      console.error("Google Drive Client was not provided");
      return;
    }
    const { permissions } = this.#state;
    this.#state = { status: "applying", permissions };
    const writePromises = [];
    for (const [fileId, filePermissions] of permissions) {
      for (const permission of filePermissions) {
        writePromises.push(
          this.googleDriveClient.writePermission(
            fileId,
            onlyWritablePermissionFields(permission),
            {
              sendNotificationEmail: false,
            }
          )
        );
      }
    }
    try {
      await Promise.all(writePromises);
    } finally {
      this.close();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-asset-share-dialog": GoogleDriveAssetShareDialog;
  }
}
