/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  GoogleDriveFolderPickedEvent,
  GraphBoardServerConnectRequestEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { BoardServer } from "@google-labs/breadboard";

@customElement("bb-board-server-overlay")
export class BoardServerOverlay extends LitElement {
  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor showGoogleDrive = false;

  @state()
  accessor serverType: "FileSystem" | "BoardServer" | "GoogleDrive" =
    "BoardServer";

  #formRef: Ref<HTMLFormElement> = createRef();
  #driveIdRef: Ref<HTMLInputElement> = createRef();

  static styles = css`
    :host {
      display: block;
    }

    form {
      display: flex;
      flex-direction: column;
      width: 85vw;
      max-width: 420px;
    }

    header {
      display: flex;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid var(--bb-neutral-300);
      margin: 0 0 var(--bb-grid-size) 0;
    }

    h1 {
      flex: 1;
      font-size: var(--bb-title-medium);
      margin: 0;
    }

    header .close {
      width: 16px;
      height: 16px;
      background: var(--bb-icon-close) center center no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    header .close:hover {
      transition-duration: 0.1s;
      opacity: 1;
    }

    label {
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 4);
      font-size: var(--bb-label-small);
      color: var(--bb-ui-600);
    }

    input,
    textarea,
    select {
      margin: var(--bb-grid-size) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-body-small);
      font-family: var(--bb-font-family);
      border: 1px solid var(--bb-neutral-400);
      resize: none;
      line-height: 1.5;
      border-radius: var(--bb-grid-size);
    }

    input[type="text"],
    input[type="url"],
    select {
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-2);
    }

    textarea {
      height: 140px;
    }

    #controls {
      display: flex;
      justify-content: flex-end;
      margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 4);
    }

    .cancel {
      background: var(--bb-neutral-200);
      color: var(--bb-neutral-600);
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px;
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    input[type="submit"] {
      background: var(--bb-ui-500);
      background-image: var(--bb-icon-resume-ui);
      background-size: 16px 16px;
      background-position: 8px 4px;
      background-repeat: no-repeat;
      color: #246db5;
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px 0 28px;
      margin: 0;
    }

    #select-source-directory {
      margin: var(--bb-grid-size) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 2);
      border-radius: 50px;
      background: var(--bb-ui-500);
      border: none;
      color: var(--bb-neutral-0);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      padding-right: var(--bb-grid-size-4);
      height: var(--bb-grid-size-7);
    }

    #select-source-directory::before {
      content: "";
      background: var(--bb-icon-add-inverted) center center / 20px 20px
        no-repeat;
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size);
    }

    .connection {
      margin: 0 var(--bb-grid-size-4);
    }

    bb-connection-input {
      margin: 0 var(--bb-grid-size-4);
    }
  `;

  protected firstUpdated(): void {
    if (!this.#formRef.value) {
      return;
    }

    const input = this.#formRef.value.querySelector(
      "input"
    ) as HTMLInputElement;
    if (!input) {
      return;
    }

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  render() {
    let fields: HTMLTemplateResult | symbol = nothing;
    switch (this.serverType) {
      case "FileSystem": {
        fields = html` <div>
          <button
            id="select-source-directory"
            @click=${() => {
              this.dispatchEvent(
                new GraphBoardServerConnectRequestEvent(
                  "FileSystemGraphProvider"
                )
              );
            }}
          >
            Choose Directory
          </button>
        </div>`;
        break;
      }

      case "BoardServer": {
        fields = html`<label>URL</label>
          <input
            name="url"
            type="url"
            placeholder="Enter the Board Server URL"
            required
          />
          <label>API Key</label>
          <input
            name="apiKey"
            type="text"
            placeholder="Enter the API Key"
            required
          />`;
        break;
      }

      case "GoogleDrive": {
        fields = html` <div class="connection">
          <input type="hidden" ${ref(this.#driveIdRef)} name="drive-id" />

          <bb-google-drive-server-picker
            @bbgoogledrivefolderpicked=${(
              evt: GoogleDriveFolderPickedEvent
            ) => {
              if (!this.#driveIdRef.value) {
                return;
              }

              this.#driveIdRef.value.value = evt.id ?? "";
            }}
          ></bb-google-drive-server-picker>
        </div>`;
        break;
      }
    }

    const supportsFileSystem = "showDirectoryPicker" in window;

    return html`<bb-overlay>
      <form
        ${ref(this.#formRef)}
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key === "Enter" && evt.metaKey && this.#formRef.value) {
            const form = this.#formRef.value;
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }

            form.dispatchEvent(new SubmitEvent("submit"));
          }
        }}
        @submit=${(evt: SubmitEvent) => {
          evt.preventDefault();
          if (!(evt.target instanceof HTMLFormElement)) {
            return;
          }

          const data = new FormData(evt.target);
          const type = data.get("type") as typeof this.serverType;
          if (!type) {
            return;
          }

          switch (type) {
            case "BoardServer": {
              let url = data.get("url") as string;
              if (!url) {
                return;
              }
              const apiKey = data.get("apiKey") as string;
              if (!apiKey) {
                return;
              }

              // Ensure there is no trailing slash on the end of the URL.
              url = url.replace(/\/$/, "");

              this.dispatchEvent(
                new GraphBoardServerConnectRequestEvent("", url, apiKey)
              );
              break;
            }

            case "FileSystem": {
              break;
            }

            case "GoogleDrive": {
              const driveFolderId = data.get("drive-id") as string;
              if (!driveFolderId) {
                console.warn(
                  "Unable to proceed - no Google Drive folder chosen"
                );
                return;
              }

              this.dispatchEvent(
                new GraphBoardServerConnectRequestEvent(
                  "google-drive-limited",
                  `drive://${driveFolderId}`
                )
              );
              this.dispatchEvent(new OverlayDismissedEvent());
              break;
            }
          }
        }}
      >
        <header>
          <h1>Add new Board Server</h1>
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="close"
            type="button"
          >
            Close
          </button>
        </header>

        <label>Type</label>
        <select
          name="type"
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLSelectElement)) {
              return;
            }

            this.serverType = evt.target.value as typeof this.serverType;
          }}
        >
          <option
            value="BoardServer"
            ?selected=${this.serverType === "BoardServer"}
          >
            Board server
          </option>
          ${supportsFileSystem
            ? html`<option
                value="FileSystem"
                ?selected=${this.serverType === "FileSystem"}
              >
                File System
              </option>`
            : nothing}
          ${this.showGoogleDrive
            ? html`<option
                value="GoogleDrive"
                ?selected=${this.serverType === "GoogleDrive"}
              >
                Google Drive
              </option>`
            : nothing}
        </select>

        ${fields}

        <div id="controls">
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="cancel"
            type="button"
          >
            Cancel
          </button>
          <input type="submit" value="Save" />
        </div>
      </form>
    </bb-overlay>`;
  }
}
