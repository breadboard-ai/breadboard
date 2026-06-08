/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import { until } from "lit/directives/until.js";
import { guard } from "lit/directives/guard.js";
import { resolveImage } from "../../../media/image.js";
import { NOTEBOOKLM_MIMETYPE } from "@breadboard-ai/utils";
import { notebookLmIcon } from "../../../styles/svg-icons.js";
import { getAssetIcon } from "../../../../utils/media/mime-type.js";
import {
  videoIdFromWatchOrShortsOrEmbedUri,
  isShareUri,
  convertShareUriToEmbedUri,
} from "../../../../utils/media/youtube.js";
import type { GraphAsset } from "../../../../sca/types.js";
import * as Styles from "../../../styles/styles.js";
import { ShowTooltipEvent, HideTooltipEvent } from "../../../events/events.js";

export { AssetThumbnail };

/**
 * A self-contained thumbnail renderer for graph assets.
 *
 * Handles images (inline, file, stored/Drive), audio (with play toggle),
 * video (YouTube thumbnails), NotebookLM, and generic file icons.
 *
 * Uses the `guard` directive to prevent re-resolving Drive images when the
 * asset handle hasn't changed, eliminating the flicker that occurred when
 * the parent re-rendered the entire asset list.
 */
@customElement("bb-asset-thumbnail")
class AssetThumbnail extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ attribute: false })
  accessor asset!: GraphAsset;

  @property()
  accessor mimeType = "";

  @property({ type: Boolean, reflect: true })
  accessor playing = false;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: var(--bb-grid-size);
      }

      .icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .notebooklm-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--bb-grid-size);
      }

      .loading-spinner {
        font-size: 16px;
        color: var(--light-dark-n-40);
      }

      .audio-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        border: none;
        background: var(--light-dark-n-90);
        color: var(--light-dark-n-10);
        border-radius: var(--bb-grid-size-2);
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;

        &:hover {
          background: var(--sys-color--primary);
          color: var(--sys-color--on-primary);
        }

        & .g-icon {
          font-size: 20px;
        }
      }
    `,
  ];

  render() {
    if (!this.asset) return nothing;

    const mimeType = this.mimeType;
    const firstPart = this.asset.data[0]?.parts[0];

    // NotebookLM
    if (mimeType === NOTEBOOKLM_MIMETYPE) {
      return html`<div class="notebooklm-wrapper">${notebookLmIcon}</div>`;
    }

    // Images
    if (mimeType.startsWith("image/") && firstPart) {
      return this.#renderImage(firstPart);
    }

    // Audio
    if (mimeType.startsWith("audio/")) {
      return this.#renderAudioToggle();
    }

    // Video
    if (mimeType.startsWith("video/") || mimeType === "youtube") {
      return this.#renderVideo(firstPart);
    }

    // Generic icon fallback
    return html`<span class="g-icon round filled"
      >${getAssetIcon(mimeType)}</span
    >`;
  }

  #renderImage(firstPart: NonNullable<GraphAsset["data"][0]>["parts"][0]) {
    if ("inlineData" in firstPart && firstPart.inlineData) {
      const dataUrl = `data:${firstPart.inlineData.mimeType};base64,${firstPart.inlineData.data}`;
      return html`<img src=${dataUrl} />`;
    }

    if ("fileData" in firstPart && firstPart.fileData) {
      return html`<img src=${firstPart.fileData.fileUri} />`;
    }

    if ("storedData" in firstPart && firstPart.storedData) {
      const handle = firstPart.storedData.handle;

      if (handle.startsWith("drive:/") && this.sca.services.googleDriveClient) {
        const client = this.sca.services.googleDriveClient;
        // Guard on the handle string — only re-resolve when it changes.
        return guard([handle], () => {
          const resolvedSrc = resolveImage(client, handle);
          return until(
            resolvedSrc.then((src) => html`<img src=${src || ""} />`),
            html`<div class="icon-wrapper">
              <span class="g-icon filled loading-spinner"
                >progress_activity</span
              >
            </div>`
          );
        });
      }

      return html`<img src=${handle} />`;
    }

    return html`<span class="g-icon round filled">image</span>`;
  }

  #renderAudioToggle() {
    const icon = this.playing ? "pause" : "play_arrow";
    return html`<button
      class="audio-toggle"
      @click=${(evt: Event) => {
        evt.stopPropagation();
        this.dispatchEvent(
          new CustomEvent("bb-audio-toggle", {
            bubbles: true,
            composed: true,
          })
        );
      }}
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent(
            this.playing ? "Pause audio" : "Play audio",
            evt.clientX,
            evt.clientY
          )
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
    >
      <span class="g-icon filled">${icon}</span>
    </button>`;
  }

  #renderVideo(
    firstPart: NonNullable<GraphAsset["data"][0]>["parts"][0] | undefined
  ) {
    if (firstPart && "fileData" in firstPart && firstPart.fileData) {
      const uri = firstPart.fileData.fileUri;
      let videoId: string | null = null;

      if (isShareUri(uri)) {
        const embedUri = convertShareUriToEmbedUri(uri);
        if (embedUri) {
          videoId = videoIdFromWatchOrShortsOrEmbedUri(embedUri);
        }
      } else {
        videoId = videoIdFromWatchOrShortsOrEmbedUri(uri);
      }

      if (videoId) {
        return html`<img
          src="https://img.youtube.com/vi/${videoId}/default.jpg"
        />`;
      }
    }

    if (
      firstPart &&
      "inlineData" in firstPart &&
      firstPart.inlineData &&
      firstPart.inlineData.mimeType.startsWith("video/")
    ) {
      return html`<span class="g-icon round filled">video_file</span>`;
    }

    return html`<span class="g-icon round filled">video_file</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-asset-thumbnail": AssetThumbnail;
  }
}
