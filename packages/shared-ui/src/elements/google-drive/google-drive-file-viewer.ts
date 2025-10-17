/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DriveFileId,
  GoogleDriveClient,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { LitElement, type PropertyValues, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { icons } from "../../styles/icons.js";

@customElement("bb-google-drive-file-viewer")
export class GoogleDriveFileViewer extends LitElement {
  static styles = [
    icons,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--drive-background, transparent);
        padding: var(--drive-padding, 0);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);

        width: 100%;
        max-width: var(--drive-max-width, initial);
        min-width: var(--drive-min-width, initial);
      }

      .loading {
        padding-left: var(--bb-grid-size-8);
        background: url(/images/progress-neutral.svg) 0 center / 20px 20px
          no-repeat;
      }

      a {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        height: 100%;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: var(--bb-grid-size);
        max-width: 540px;
      }

      .image-placeholder {
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        position: relative;
        background: var(--n-80);
        box-shadow: inset 0 0 0 3px var(--n-90);
        border-radius: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-3);
        width: 100%;
        aspect-ratio: 268/168;
        max-width: 240px;
        max-width: 268px;

        > .g-icon {
          font-size: var(--icon-size, 60px);
          color: var(--n-40);
        }

        & .link-out {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--bb-grid-size-8);
          height: var(--bb-grid-size-8);
          border-radius: var(--bb-grid-size-3);
          background: var(--n-0);
          color: var(--n-100);
          top: var(--bb-grid-size-3);
          right: var(--bb-grid-size-3);

          & > .g-icon {
            font-size: 18px;
          }
        }
      }
    `,
  ];

  @property({
    hasChanged: (
      newVal: DriveFileId | string | null,
      oldVal: DriveFileId | string | null
    ): boolean => {
      if (
        newVal === null ||
        oldVal === null ||
        typeof newVal === "string" ||
        typeof oldVal === "string"
      ) {
        return newVal !== oldVal;
      }
      return (
        newVal.id !== oldVal.id || newVal.resourceKey !== oldVal.resourceKey
      );
    },
  })
  accessor fileId: DriveFileId | string | null = null;

  @consume({ context: googleDriveClientContext })
  @property({ attribute: false })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  @state()
  accessor #imageFailedToLoad = false;

  @property({ reflect: true, type: Boolean })
  accessor forcePlaceholder = false;

  readonly #loadTask = new Task(this, {
    task: async ([googleDriveClient, fileId], { signal }) => {
      if (!googleDriveClient || !fileId) {
        return undefined;
      }
      try {
        return await googleDriveClient.getFileMetadata(fileId, {
          fields: ["id", "name", "webViewLink", "thumbnailLink", "iconLink"],
          signal,
        });
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    args: () => [this.googleDriveClient, this.fileId],
  });

  override willUpdate(changes: PropertyValues<this>) {
    if (changes.has("fileId")) {
      this.#imageFailedToLoad = false;
    }
  }

  override render() {
    return this.#loadTask.render({
      pending: () =>
        html`<div class="loading">Loading Google Drive file...</div>`,
      error: () => `Error loading Google Drive file`,
      complete: (file) => {
        if (!file) {
          return `Unable to find Google Drive document`;
        }
        const openUrl =
          file.webViewLink ?? `https://drive.google.com/open?id=${file.id}`;
        const imageUrl = file.thumbnailLink || file.iconLink;
        // Bump the image quality a little higher.
        const largerImageUrl = imageUrl.replace(/=s220$/, "=s440");
        return html`
          <a href=${openUrl} target="_blank">
            ${imageUrl && !this.#imageFailedToLoad && !this.forcePlaceholder
              ? html`
                  <img
                    cross-origin
                    src=${largerImageUrl}
                    alt=${file.name ?? "Google Document"}
                    @error=${this.#onImageError}
                  />
                `
              : html`
                  <div class="image-placeholder">
                    <span class="g-icon filled round">docs</span>

                    <span class="link-out">
                      <span class="g-icon filled-heavy round">open_in_new</span>
                    </span>
                  </div>
                `}
          </a>
        `;
      },
    });
  }

  #onImageError() {
    // We quite often get 429 Too Many Requests errors during development when
    // rendering thumbnail images. Probably the Google Drive image service has a
    // very low throttle threshold when the Referrer is localhost.
    this.#imageFailedToLoad = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-file-viewer": GoogleDriveFileViewer;
  }
}
