/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";

@customElement("bb-google-drive-file-viewer")
export class GoogleDriveFileViewer extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bb-neutral-50);
      padding: var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .loading {
      padding-left: var(--bb-grid-size-8);
      background: url(/images/progress-neutral.svg) 0 center / 20px 20px
        no-repeat;
    }

    img {
      max-width: 100%;
      border-radius: var(--bb-grid-size);
    }
  `;

  @property()
  accessor fileId: string | null = null;

  @consume({ context: googleDriveClientContext })
  @property({ attribute: false })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  readonly #loadTask = new Task(this, {
    task: async ([googleDriveClient, fileId], { signal }) => {
      if (!googleDriveClient || !fileId) {
        return undefined;
      }
      try {
        return await googleDriveClient.readFile(fileId, {
          fields: ["name", "webViewLink", "thumbnailLink", "iconLink"],
          signal,
        });
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    args: () => [this.googleDriveClient, this.fileId],
  });

  override render() {
    return this.#loadTask.render({
      pending: () =>
        html`<div class="loading">Loading Google Drive file...</div>`,
      error: () => `Error loading Google Drive file`,
      complete: (file) => {
        if (!file) {
          return `Unable to find Google Drive document`;
        }
        return html`
          <a href=${file.webViewLink ?? ""} target="_blank">
            <img
              cross-origin
              src=${file.thumbnailLink || file.iconLink || ""}
              alt=${file.name ?? "Google Document"}
            />
          </a>
        `;
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-file-viewer": GoogleDriveFileViewer;
  }
}
