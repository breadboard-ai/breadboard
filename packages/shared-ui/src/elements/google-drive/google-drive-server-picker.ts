/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  GoogleDriveFolderPickedEvent,
  InputEnterEvent,
} from "../../events/events";
import { Task } from "@lit/task";

const DRIVE_CONNECTION_ID = "google-drive-limited";
const ALL_BOARD_SERVER_FOLDERS_QUERY =
  "appProperties has { key = 'breadboard' and value = 'root' } and trashed = false";

@customElement("bb-google-drive-server-picker")
export class GoogleDriveServerPicker extends LitElement {
  @state()
  accessToken: string | null = null;

  render() {
    return html`
      <bb-connection-input
        .connectionId=${DRIVE_CONNECTION_ID}
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
  accessToken: string | null = null;

  @state()
  newlyCreated: DriveFile | null = null;

  #pickFolderTask = new Task(this, {
    task: async ([accessToken]) => {
      const files = new Files(accessToken!);
      const response = await fetch(
        files.makeQueryRequest(ALL_BOARD_SERVER_FOLDERS_QUERY)
      );
      const json = (await response.json()) as DriveFileList;
      return json.files;
    },
    args: () => [this.accessToken],
  });

  #selectExistingFolder(evt: Event) {
    const { value } = evt.target as HTMLSelectElement;
    if (!value) return;
    this.dispatchEvent(new GoogleDriveFolderPickedEvent(value));
  }

  async #createNewFolder() {
    // TODO: Make this configurable via UI.
    const folderName = "Breadboard";
    const files = new Files(this.accessToken!);
    const response = await fetch(
      files.makeCreateRequest({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: {
          breadboard: "root",
        },
      })
    );
    this.newlyCreated = (await response.json()) as DriveFile;
    this.dispatchEvent(new GoogleDriveFolderPickedEvent(this.newlyCreated.id));
  }

  render() {
    return this.#pickFolderTask.render({
      pending: () => html`Loading`,
      complete: (files) => {
        if (this.newlyCreated) {
          return html`Folder: ${this.newlyCreated.name}`;
        }
        return html`${files.length === 0
            ? ""
            : html`<div>
                <select @change=${this.#selectExistingFolder}>
                  <option value="">
                    -- Pick an existing board server folder --
                  </option>
                  ${files.map((file) => {
                    return html`<option value="${file.id}">
                      ${file.name}
                    </option>`;
                  })}
                </select>
                <p>Or create a new board server folder</p>
              </div>`}
          <button @click=${this.#createNewFolder}>Create New</button>`;
      },
      error: () => {
        return html`Error accessing Google Drive`;
      },
    });
  }
}

// TODO: Somehow move to google-drive-kit
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
