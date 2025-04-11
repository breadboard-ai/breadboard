/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  GoogleDriveFolderPickedEvent,
  InputEnterEvent,
} from "../../events/events";
import { Task } from "@lit/task";

const DRIVE_CONNECTION_ID = "$sign-in";
const ALL_BOARD_SERVER_FOLDERS_QUERY =
  "appProperties has { key = 'breadboard' and value = 'root' } and trashed = false";

@customElement("bb-google-drive-server-picker")
export class GoogleDriveServerPicker extends LitElement {
  @state()
  accessor accessToken: string | null = null;

  static styles = css`
    :host {
      display: block;
    }

    bb-connection-input {
      padding: var(--bb-grid-size-3);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      margin-bottom: var(--bb-grid-size-3);
    }

    p {
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      margin: 0 0 var(--bb-grid-size-2) 0;
    }
  `;

  render() {
    return html`
      <bb-connection-input
        .connectionId=${DRIVE_CONNECTION_ID}
        @bbconnectionsignedout=${() => {
          this.accessToken = null;
        }}
        @bbinputenter=${(evt: InputEnterEvent) => {
          const {
            data: { clientId, secret },
          } = evt;
          if (clientId && secret) {
            this.accessToken = secret as string;
          }
        }}
      ></bb-connection-input>
      ${this.accessToken
        ? html`<bb-google-drive-server-dir-picker
            .accessToken=${this.accessToken}
          ></bb-google-drive-server-dir-picker>`
        : nothing}
    `;
  }
}

type DriveFile = {
  kind: "drive#file";
  mimeType: string;
  id: string;
  name: string;
};

type DriveFileList = {
  kind: "drive#fileList";
  files: DriveFile[];
};

// TODO: Figure out what to do with this class: Fold into the class above?
// Put it into its own class?
@customElement("bb-google-drive-server-dir-picker")
export class GoogleDriveServerDirPicker extends LitElement {
  @property()
  accessor accessToken: string | null = null;

  @state()
  accessor action: "create" | "use-existing" = "use-existing";

  #newlyCreated: string | null = null;

  static styles = css`
    :host {
      display: block;
    }

    h1 {
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      margin: 0 0 var(--bb-grid-size) 0;
    }

    p {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      margin: 0 0 var(--bb-grid-size-2) 0;
    }

    form {
      margin-bottom: var(--bb-grid-size-3);
    }

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    #show-folders,
    #new-folder {
      background: transparent;
      border: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      padding: 0;
    }

    #new-folder {
      margin-left: var(--bb-grid-size-2);
    }

    #folder-input {
      display: grid;
      grid-template-columns: 1fr min-content;
      column-gap: var(--bb-grid-size-2);
    }

    #add-folder {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #add-folder::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #add-folder:hover,
    #add-folder:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }
  `;

  #pickFolderTask = this.#createLoadTask(null);

  #createLoadTask(folderName: string | null) {
    return new Task(this, {
      task: async ([accessToken, folderName]) => {
        const files = new Files(accessToken!);
        if (folderName) {
          await fetch(
            files.makeCreateRequest({
              name: folderName,
              mimeType: "application/vnd.google-apps.folder",
              appProperties: {
                breadboard: "root",
              },
            })
          );

          this.#newlyCreated = folderName;
        } else {
          this.#newlyCreated = null;
        }

        const response = await fetch(
          files.makeQueryRequest(ALL_BOARD_SERVER_FOLDERS_QUERY)
        );
        const json = (await response.json()) as DriveFileList;
        return json.files;
      },
      args: () => [this.accessToken, folderName],
    });
  }

  render() {
    return this.#pickFolderTask.render({
      pending: () => html`<p>Loading Google Drive Folders - please wait</p>`,
      complete: (folders) => {
        if (this.action === "use-existing" && folders.length) {
          // Default to using the first item.
          this.dispatchEvent(new GoogleDriveFolderPickedEvent(folders[0].id));

          return html`<form
            @submit=${(evt: SubmitEvent) => {
              evt.preventDefault();
              if (!(evt.target instanceof HTMLFormElement)) {
                return;
              }

              const data = new FormData(evt.target);
              const folderName = data.get("folder-name") as string | null;
              if (!folderName) {
                return;
              }
            }}
          >
            <h1>Choose a Google Drive folder</h1>
            <p>Select which folder you would like to use.</p>
            <div>
              ${folders.length === 0
                ? html`There are no Google Drive Folders available - please
                  create one.`
                : html`<select
                      @input=${(evt: InputEvent) => {
                        if (!(evt.target instanceof HTMLSelectElement)) {
                          return;
                        }

                        const { value } = evt.target;
                        if (!value) return;
                        this.dispatchEvent(
                          new GoogleDriveFolderPickedEvent(value)
                        );
                      }}
                    >
                      ${folders.map((file) => {
                        return html`<option
                          ?selected=${this.#newlyCreated === file.name}
                          value="${file.id}"
                        >
                          ${file.name}
                        </option>`;
                      })}
                    </select>
                    <button
                      id="new-folder"
                      @click=${() => {
                        this.action = "create";
                      }}
                    >
                      Create a new folder instead
                    </button>`}
            </div>
          </form> `;
        } else {
          // The user hasn't chosen an item.
          this.dispatchEvent(new GoogleDriveFolderPickedEvent(null));

          return html` <form
              @submit=${async (evt: SubmitEvent) => {
                evt.preventDefault();
                if (!(evt.target instanceof HTMLFormElement)) {
                  return;
                }

                const data = new FormData(evt.target);
                const folderName = data.get("folder-name") as string | null;
                if (!folderName) {
                  return;
                }

                this.#pickFolderTask = this.#createLoadTask(folderName);
                if (this.action === "create") {
                  this.action = "use-existing";
                } else {
                  this.requestUpdate();
                }
              }}
            >
              <h1>Create a new folder</h1>
              <p>
                You can create a new folder by entering the name below and
                pressing Create.
              </p>
              <div id="folder-input">
                <input
                  name="folder-name"
                  id="folder-name"
                  type="text"
                  placeholder="Enter a folder name"
                  .value=${"Breadboard"}
                  required
                />
                <button id="add-folder">Create</button>
              </div>
            </form>

            ${folders.length > 0
              ? html`<button
                  id="show-folders"
                  @click=${() => {
                    this.action = "use-existing";
                  }}
                >
                  Show my Google Driver folders
                </button>`
              : nothing}`;
        }
      },
      error: () => {
        return html`Error accessing Google Drive`;
      },
    });
  }
}

// TODO: Somehow consolidate with the one in
// google-drive-kit
class Files {
  #accessToken: string;

  constructor(accessToken: string) {
    this.#accessToken = accessToken;
  }

  makeQueryRequest(query: string): Request {
    return new Request(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.#accessToken}`,
      },
    });
  }

  makeCreateRequest(body: unknown): Request {
    return new Request("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#accessToken}`,
      },
      body: JSON.stringify(body),
    });
  }
}
