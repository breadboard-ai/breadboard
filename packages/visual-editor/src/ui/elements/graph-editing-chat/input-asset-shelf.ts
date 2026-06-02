/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";

import type { GraphAssetDescriptor } from "../../../sca/types.js";
import { icons } from "../../styles/icons.js";
import {
  isInlineData,
  isStoredData,
  isFileDataCapabilityPart,
} from "../../../data/common.js";
import {
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  videoIdFromWatchOrShortsOrEmbedUri,
} from "../../../utils/media/youtube.js";
import { NOTEBOOKLM_MIMETYPE } from "@breadboard-ai/utils";

export { InputAssetShelf };

/**
 * Renders a horizontal scrolling strip of asset thumbnails, driven
 * entirely by the `InputAssetController` via SCA context. Shows nothing
 * when the controller has no assets. Each thumbnail displays a preview
 * (image/video) or a mime-type icon, with a remove button on hover.
 *
 * This component is a pure rendering shell — it holds no state.
 */
@customElement("bb-input-asset-shelf")
class InputAssetShelf extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    icons,
    css`
      :host {
        display: contents;
      }

      .shelf {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-3)
          var(--bb-grid-size-2);
        gap: var(--bb-grid-size-2);
      }

      .shelf::-webkit-scrollbar {
        display: none;
      }

      .thumb {
        position: relative;
        flex: 0 0 auto;
        width: 80px;
        height: 60px;
      }

      .thumb-content {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        border-radius: var(--bb-grid-size-2);
        overflow: hidden;
        background: var(--light-dark-n-95);
        border: 2px solid var(--light-dark-n-90);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .thumb .icon {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--light-dark-n-50);
        font-size: 24px;
      }

      .thumb .remove {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: none;
        background: var(--light-dark-n-30);
        color: var(--light-dark-n-100);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        padding: 0;
        opacity: 0;
        transition: opacity 0.15s ease;
        z-index: 1;
      }

      .thumb:hover .remove {
        opacity: 1;
      }
    `,
  ];

  render() {
    const inputAssets = this.sca.controller.editor.inputAssets;
    if (!inputAssets.populated) return nothing;

    return html`
      <div class="shelf">
        ${inputAssets.assets.map((asset) => this.#renderThumb(asset))}
      </div>
    `;
  }

  #renderThumb(asset: GraphAssetDescriptor) {
    const inputAssets = this.sca.controller.editor.inputAssets;
    let preview: ReturnType<typeof html> | typeof nothing = nothing;
    let icon = "attachment";
    const title = asset.metadata?.title || "";

    for (const data of asset.data) {
      for (const part of data.parts) {
        if (isInlineData(part)) {
          if (part.inlineData.mimeType.startsWith("image")) {
            preview = html`<img
              src="data:${part.inlineData.mimeType};base64,${part.inlineData
                .data}"
              title="${title}"
            />`;
            break;
          }
          if (part.inlineData.mimeType.startsWith("audio")) {
            icon = "mic";
            break;
          }
          if (part.inlineData.mimeType.startsWith("video")) {
            icon = "movie";
            break;
          }
          if (part.inlineData.mimeType.includes("pdf")) {
            icon = "drive_pdf";
            break;
          }
          if (part.inlineData.mimeType.startsWith("text")) {
            icon = "text_fields";
            break;
          }
        } else if (isFileDataCapabilityPart(part)) {
          if (part.fileData.mimeType === "video/mp4") {
            let uri: string | null = part.fileData.fileUri;
            if (isWatchUri(uri) || isShortsUri(uri)) {
              uri = convertWatchOrShortsUriToEmbedUri(uri);
            } else if (isShareUri(uri)) {
              uri = convertShareUriToEmbedUri(uri);
            }
            if (uri && isEmbedUri(uri)) {
              const videoId = videoIdFromWatchOrShortsOrEmbedUri(uri);
              if (videoId) {
                preview = html`<img
                  src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg"
                  title="${title}"
                />`;
              }
            }
            icon = "smart_display";
            break;
          }
          icon = "insert_drive_file";
        } else if (
          isStoredData(part) &&
          part.storedData.mimeType === NOTEBOOKLM_MIMETYPE
        ) {
          icon = "auto_stories";
          break;
        }
      }
      if (preview !== nothing) {
        break;
      }
    }

    return html`
      <div class="thumb" title="${title}">
        <div class="thumb-content">
          ${preview !== nothing
            ? preview
            : html`<div class="icon">
                <span class="g-icon">${icon}</span>
              </div>`}
        </div>
        <button
          class="remove"
          @click=${() => inputAssets.remove(asset)}
          title="Remove ${title}"
        >
          <span class="g-icon">close</span>
        </button>
      </div>
    `;
  }
}
