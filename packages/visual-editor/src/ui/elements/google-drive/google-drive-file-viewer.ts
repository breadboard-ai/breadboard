/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { LitElement, type PropertyValues, css, html } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property, state } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";
import { HideTooltipEvent, ShowTooltipEvent } from "../../events/events.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

@customElement("bb-google-drive-file-viewer")
export class GoogleDriveFileViewer extends SignalWatcher(LitElement) {
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

      .video-loading {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
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

      .video-container {
        position: relative;
        width: 100%;
        max-width: 540px;
        aspect-ratio: 16/9;
        background: #000;
        border-radius: var(--bb-grid-size-3);
        overflow: hidden;
      }

      .video-thumbnail {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        line-height: 0;
        z-index: 1;

        & img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .image-placeholder {
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        position: relative;
        background: oklch(from var(--light-dark-n-0) l c h / calc(alpha * 0.2));
        box-shadow: inset 0 0 0 3px var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-3);
        width: 100%;
        aspect-ratio: 268/168;
        max-width: 240px;
        max-width: 268px;

        > .g-icon {
          font-size: var(--icon-size, 60px);
          color: var(--light-dark-n-40);
        }

        & .link-out {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--bb-grid-size-8);
          height: var(--bb-grid-size-8);
          border-radius: var(--bb-grid-size-3);
          background: var(--light-dark-n-0);
          color: var(--light-dark-n-100);
          top: var(--bb-grid-size-3);
          right: var(--bb-grid-size-3);

          & > .g-icon {
            pointer-events: none;
            font-size: 18px;
          }
        }
      }
    `,
    css`
      .video-embed {
        width: 100%;
        height: 100%;
        border: none;
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

  @consume({ context: scaContext })
  accessor sca!: SCA;

  @state()
  accessor #imageFailedToLoad = false;

  #videoUrl: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor forcePlaceholder = false;

  readonly #loadTask = new Task(this, {
    task: async ([googleDriveClient, fileId], { signal }) => {
      if (!googleDriveClient || !fileId) {
        return undefined;
      }
      try {
        return await googleDriveClient.getFileMetadata(fileId, {
          fields: [
            "id",
            "name",
            "mimeType",
            "webViewLink",
            "thumbnailLink",
            "iconLink",
          ],
          signal,
        });
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    args: () => [this.sca.services.googleDriveClient, this.fileId],
  });

  readonly #videoUrlTask = new Task(this, {
    task: async ([googleDriveClient, fileId], { signal }) => {
      if (!googleDriveClient || !fileId) {
        return undefined;
      }

      if (this.#videoUrl) {
        return this.#videoUrl;
      }

      const response = await googleDriveClient.getFileMedia(fileId, { signal });
      if (!response.ok) {
        throw new Error("Failed to load video content.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      this.#videoUrl = url;
      return url;
    },
    args: () => [this.sca.services.googleDriveClient, this.fileId],
  });

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#revokeVideoUrl();
  }

  #revokeVideoUrl() {
    if (this.#videoUrl) {
      URL.revokeObjectURL(this.#videoUrl);
      this.#videoUrl = null;
    }
  }

  override willUpdate(changes: PropertyValues<this>) {
    if (changes.has("fileId")) {
      this.#imageFailedToLoad = false;
      this.#revokeVideoUrl();
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

        if (file.mimeType?.startsWith("video/")) {
          return html`
            <div class="video-container">
              ${this.#videoUrlTask.render({
                pending: () =>
                  html`<div
                    class="video-thumbnail"
                    @click=${() => {
                      this.#videoUrl = null;
                      this.#videoUrlTask.run();
                    }}
                  >
                    <img
                      cross-origin
                      src=${file.thumbnailLink}
                      alt=${file.name ?? "Google Document"}
                      @error=${this.#onImageError}
                    />
                    <div class="video-loading">Loading...</div>
                  </div>`,
                error: () => html`<p>Error loading video source</p>`,
                complete: (url) => html`
                  <video
                    class="video-embed"
                    src="${url}"
                    controls
                    poster=${file.thumbnailLink}
                  ></video>
                `,
              })}
            </div>
          `;
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

                    <span
                      class="link-out"
                      @pointerover=${(evt: PointerEvent) => {
                        this.dispatchEvent(
                          new ShowTooltipEvent(
                            "Open in new tab",
                            evt.clientX,
                            evt.clientY
                          )
                        );
                      }}
                      @pointerout=${() => {
                        this.dispatchEvent(new HideTooltipEvent());
                      }}
                      @click=${() => {
                        this.dispatchEvent(new HideTooltipEvent());
                      }}
                    >
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
