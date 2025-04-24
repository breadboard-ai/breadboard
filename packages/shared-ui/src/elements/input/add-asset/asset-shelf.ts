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
  convertWatchUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isWatchUri,
  videoIdFromWatchOrEmbedUri,
} from "../../../utils/youtube";

@customElement("bb-asset-shelf")
export class AssetShelf extends LitElement {
  @property()
  accessor name: string = "asset-shelf";

  static styles = css`
    :host {
      display: flex;
      overflow-x: scroll;
      overflow-y: hidden;
      scrollbar-width: none;
    }

    .value {
      display: block;
      height: 72px;
      aspect-ratio: 16/9;
      margin: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
      position: relative;
      flex: 0 0 auto;

      & :not(button) {
        object-fit: cover;
        width: 100%;
        height: 100%;
        border-radius: var(--bb-grid-size-2);
      }

      & .text,
      & .audio,
      & .gdrive {
        border: 1px solid var(--primary-color, var(--bb-neutral-300));
      }

      & .audio {
        background: var(--bb-icon-mic)
          var(--background-color, var(--bb-neutral-0)) center center / 20px 20px
          no-repeat;
      }

      & .text {
        background: var(--bb-icon-text)
          var(--background-color, var(--bb-neutral-0)) center center / 20px 20px
          no-repeat;
      }

      & .gdrive {
        background: var(--bb-icon-google-drive-outline)
          var(--background-color, var(--bb-neutral-0)) center center / 20px 20px
          no-repeat;
      }

      & .delete {
        position: absolute;
        top: calc(-1 * var(--bb-grid-size-2));
        right: calc(-1 * var(--bb-grid-size-2));
        width: 20px;
        height: 20px;
        border: none;
        border-radius: 50%;
        font-size: 0;
        background: var(--secondary-color) var(--bb-icon-close) center center /
          20px 20px no-repeat;
        z-index: 1;

        &:not([disabled]) {
          opacity: 1;
          cursor: pointer;
        }
      }
    }
  `;

  #assets: LLMContent[] = [];

  get value() {
    return this.#assets;
  }

  set value(assets: LLMContent[]) {
    this.#assets = assets;
  }

  addAsset(addedAsset: LLMContent) {
    this.#assets.push(addedAsset);
    requestAnimationFrame(() => {
      this.requestUpdate();
    });
  }

  removeAsset(removedAsset: LLMContent) {
    this.#assets = this.#assets.filter((asset) => asset !== removedAsset);
    requestAnimationFrame(() => {
      this.requestUpdate();
    });
  }

  clear() {
    this.#assets = [];
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
          }
          if (part.inlineData.mimeType.startsWith("audio")) {
            value = html`<div class="audio"></div>`;
          }
          if (part.inlineData.mimeType.startsWith("text")) {
            value = html`<div class="text"></div>`;
          }
        } else if (isFileDataCapabilityPart(part)) {
          switch (part.fileData.mimeType) {
            case "video/mp4": {
              let uri: string | null = part.fileData.fileUri;
              if (isWatchUri(uri)) {
                uri = convertWatchUriToEmbedUri(uri);
              } else if (isShareUri(uri)) {
                uri = convertShareUriToEmbedUri(uri);
              } else if (!isEmbedUri(uri)) {
                uri = null;
              }

              if (!isEmbedUri(uri) || uri === null) {
                value = html`Error`;
                break;
              }

              const videoId = videoIdFromWatchOrEmbedUri(uri);
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
                value = html`<div class="gdrive"></div>`;
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
            Delete
          </button>
          ${value}
        </div>`;
      });
    })}`;
  }
}
