/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LLMContent } from "@breadboard-ai/types";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
  videoIdFromWatchOrShortsOrEmbedUri,
} from "../../../../utils/media/youtube.js";
import { icons } from "../../../styles/icons.js";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isStoredData,
} from "../../../../data/common.js";
import { NOTEBOOKLM_MIMETYPE, parseNotebookLmId } from "@breadboard-ai/utils";
import "../../notebooklm-viewer/notebooklm-viewer.js";
import { notebookLmIcon } from "../../../styles/svg-icons.js";

@customElement("bb-asset-shelf")
export class AssetShelf extends LitElement {
  @property()
  accessor name: string = "asset-shelf";

  @property({ reflect: true, type: Boolean })
  accessor populated = false;

  static styles = [
    icons,
    css`
      :host {
        display: flex;
        overflow-x: scroll;
        overflow-y: hidden;
        scrollbar-width: none;
      }

      .value {
        display: block;
        width: 160px;
        height: 120px;
        aspect-ratio: 16/12;
        margin: var(--bb-grid-size-4) var(--bb-grid-size-4) 0 0;
        position: relative;
        flex: 0 0 auto;

        & > *:not(button) {
          display: block;
          object-fit: cover;
          width: 100%;
          height: 100%;
          border-radius: var(--bb-grid-size-4);
          box-sizing: border-box;
          border: 4px solid var(--light-dark-p-100, var(--light-dark-n-100));
          box-shadow: 0px 0px 5.4px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          --icon-size: 32px;

          > * {
            display: block;
            height: 100%;
            width: 100%;
            border-radius: var(--bb-grid-size-3);
            object-fit: cover;
          }
        }

        & .audio,
        & .csv,
        & .text,
        & .movie,
        & .pdf {
          background: var(--light-dark-p-10, var(--light-dark-n-40));
        }

        .scrim {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0) 33%,
            rgba(0, 0, 0, 0.8) 100%
          );
          display: flex;
          align-items: flex-end;
          color: var(--light-dark-p-100, var(--light-dark-n-100));

          & .info {
            white-space: nowrap;
            width: 100%;
            text-overflow: ellipsis;
            overflow: hidden;
            height: 20px;
            margin: var(--bb-grid-size-2) var(--bb-grid-size-2)
              var(--bb-grid-size-2) 0;
            border-radius: 0;
            font: 400 var(--bb-title-medium) / 1 var(--bb-font-family);
          }

          & .g-icon {
            height: 20px;
            width: 28px;
            margin: var(--bb-grid-size-2) var(--bb-grid-size-2) 10px
              var(--bb-grid-size-2);
          }
        }

        & .delete {
          position: absolute;
          top: calc(-1 * var(--bb-grid-size-2));
          right: calc(-1 * var(--bb-grid-size-2));
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 50%;
          font-size: 0;
          background: var(--light-dark-n-80, var(--light-dark-n-80));
          z-index: 1;
          box-shadow: 0px 0px 5.4px rgba(0, 0, 0, 0.25);

          &:not([disabled]) {
            opacity: 1;
            cursor: pointer;
          }
        }
      }
    `,
  ];

  #assets: LLMContent[] = [];

  get value() {
    return this.#assets;
  }

  set value(assets: LLMContent[]) {
    this.#assets = assets;
  }

  addAsset(addedAsset: LLMContent) {
    this.#assets.push(addedAsset);
    this.populated = this.#assets.length > 0;
    requestAnimationFrame(() => {
      this.requestUpdate();
    });
  }

  removeAsset(removedAsset: LLMContent) {
    this.#assets = this.#assets.filter((asset) => asset !== removedAsset);
    this.populated = this.#assets.length > 0;
    this.dispatchEvent(new Event("assetchanged"));
    requestAnimationFrame(() => {
      this.requestUpdate();
    });
  }

  clear() {
    this.#assets = [];
    this.populated = false;
    requestAnimationFrame(() => {
      this.requestUpdate();
    });
  }

  render() {
    return html`${repeat(this.#assets, (asset) => {
      let assetIcon: string | HTMLTemplateResult = "upload";
      let assetTypeLabel = "Upload";
      return asset.parts.map((part) => {
        let value: HTMLTemplateResult | symbol = nothing;
        if (isInlineData(part)) {
          if (part.inlineData.mimeType.startsWith("image")) {
            assetIcon = "image";
            assetTypeLabel = "Image";
            value = html`<img
              src="data:${part.inlineData.mimeType};base64,${part.inlineData
                .data}"
            />`;
          } else if (part.inlineData.mimeType.startsWith("audio")) {
            assetIcon = "mic";
            assetTypeLabel = "Audio";
            value = html`<div class="audio"></div>`;
          } else if (part.inlineData.mimeType === "text/csv") {
            assetIcon = "csv";
            assetTypeLabel = "CSV";
            value = html`<div class="csv"></div>`;
          } else if (part.inlineData.mimeType.startsWith("text")) {
            assetIcon = "text_fields";
            assetTypeLabel = "Text";
            value = html`<div class="text"></div>`;
          } else if (part.inlineData.mimeType.startsWith("video")) {
            assetIcon = "movie";
            assetTypeLabel = "Movie";
            value = html`<div class="movie"></div>`;
          } else if (part.inlineData.mimeType.includes("pdf")) {
            assetIcon = "drive_pdf";
            assetTypeLabel = "PDF";
            value = html`<div class="pdf"></div>`;
          }
        } else if (isFileDataCapabilityPart(part)) {
          switch (part.fileData.mimeType) {
            case "video/mp4": {
              assetIcon = "video_youtube";
              assetTypeLabel = "YouTube";
              let uri: string | null = part.fileData.fileUri;
              if (isWatchUri(uri) || isShortsUri(uri)) {
                uri = convertWatchOrShortsUriToEmbedUri(uri);
              } else if (isShareUri(uri)) {
                uri = convertShareUriToEmbedUri(uri);
              } else if (!isEmbedUri(uri)) {
                uri = null;
              }

              if (!isEmbedUri(uri) || uri === null) {
                value = html`Error`;
                break;
              }

              const videoId = videoIdFromWatchOrShortsOrEmbedUri(uri);
              value = html`<a href="https://www.youtube.com/watch?v=${videoId}">
                <img
                  src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg"
                />
              </a>`;
              break;
            }

            default: {
              if (
                part.fileData.mimeType.startsWith("application/vnd.google-apps")
              ) {
                assetIcon = "drive";
                assetTypeLabel = "Document";
                value = html`<bb-google-drive-file-viewer
                  .fileId=${part.fileData.fileUri}
                ></bb-google-drive-file-viewer>`;
                break;
              }
            }
          }
        } else if (
          isStoredData(part) &&
          part.storedData.mimeType === NOTEBOOKLM_MIMETYPE
        ) {
          assetIcon = notebookLmIcon;
          assetTypeLabel = "ReferenceNotebookLM";
          const notebookId = parseNotebookLmId(part.storedData.handle);
          value = html`<bb-notebooklm-viewer
            .notebookId=${notebookId ?? null}
            displayMode="thumbnail"
          ></bb-notebooklm-viewer>`;
        }

        return html` <div class="value">
          <button
            class="delete"
            @click=${() => {
              this.removeAsset(asset);
            }}
          >
            <span class="g-icon">close</span>
          </button>
          ${value}
          <span class="scrim">
            <span class="g-icon">${assetIcon}</span>
            <span class="info">${assetTypeLabel}</span>
          </span>
        </div>`;
      });
    })}`;
  }
}
