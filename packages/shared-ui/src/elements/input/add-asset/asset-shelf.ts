/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LLMContent } from "@breadboard-ai/types";
import {
  isFileDataCapabilityPart,
  isInlineData,
} from "@google-labs/breadboard";
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
} from "../../../utils/youtube";
import { icons } from "../../../styles/icons.js";

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
          border: 4px solid var(--p-100, var(--bb-neutral-0));
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

        & .text,
        & .audio,
        & .gdrive {
          border: 1px solid var(--primary-color, var(--bb-neutral-300));
        }

        & .audio {
          background: var(--bb-icon-mic)
            var(--background-color, var(--bb-neutral-0)) center center / 20px
            20px no-repeat;
        }

        & .text {
          background: var(--bb-icon-text)
            var(--background-color, var(--bb-neutral-0)) center center / 20px
            20px no-repeat;
        }

        & .movie,
        & .csv,
        & .pdf {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-color, var(--bb-neutral-300));
          background: var(--background-color, var(--bb-neutral-0));

          & .g-icon {
            font-size: var(--bb-grid-size-11);
          }
        }

        & .gdrive {
          background: var(--bb-icon-google-drive-outline)
            var(--background-color, var(--bb-neutral-0)) center center / 20px
            20px no-repeat;
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
          background: var(--n-80, var(--bb-neutral-400));
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
      return asset.parts.map((part) => {
        let value: HTMLTemplateResult | symbol = nothing;
        if (isInlineData(part)) {
          if (part.inlineData.mimeType.startsWith("image")) {
            value = html`<img
              src="data:${part.inlineData.mimeType};base64,${part.inlineData
                .data}"
            />`;
          } else if (part.inlineData.mimeType.startsWith("audio")) {
            value = html`<div class="audio"></div>`;
          } else if (part.inlineData.mimeType === "text/csv") {
            value = html`<div class="csv">
              <span class="g-icon">csv</span>
            </div>`;
          } else if (part.inlineData.mimeType.startsWith("text")) {
            value = html`<div class="text"></div>`;
          } else if (part.inlineData.mimeType.startsWith("video")) {
            value = html`<div class="movie">
              <span class="g-icon">movie</span>
            </div>`;
          } else if (part.inlineData.mimeType.includes("pdf")) {
            value = html`<div class="pdf">
              <span class="g-icon">drive_pdf</span>
            </div>`;
          }
        } else if (isFileDataCapabilityPart(part)) {
          switch (part.fileData.mimeType) {
            case "video/mp4": {
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
                value = html`<bb-google-drive-file-viewer
                  .fileId=${part.fileData.fileUri}
                ></bb-google-drive-file-viewer>`;
                break;
              }
            }
          }
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
        </div>`;
      });
    })}`;
  }
}
