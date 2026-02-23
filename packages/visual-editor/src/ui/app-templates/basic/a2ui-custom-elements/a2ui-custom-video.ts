/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
} from "../../../../utils/media/youtube.js";
import { Task } from "@lit/task";
import { icons } from "../../../../a2ui/0.8/styles/icons.js";

@customElement("a2ui-custom-video")
export class A2UICustomVideo extends A2UI.v0_8.UI.Root {
  @property()
  accessor fileUri: A2UI.v0_8.Primitives.StringValue | null = null;

  @property()
  accessor url: A2UI.v0_8.Primitives.StringValue | null = null;

  override accessor isMedia = true;

  static styles = [
    icons,
    css`
      :host {
        display: block;
      }

      iframe,
      video {
        display: block;
        width: 100%;
        border-radius: var(--a2ui-video-radius, 20px);
      }

      iframe {
        aspect-ratio: 16/9;
        border: none;

        &.vertical {
          aspect-ratio: 9/16;
        }
      }

      video {
        object-fit: cover;
      }

      .loading-message {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        aspect-ratio: 16 / 9;
        border-radius: var(--a2ui-video-radius, 20px);
        color: var(--a2ui-loading-color, light-dark(var(--p-20), var(--n-100)));
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }
        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  #blobUrls: string[] = [];
  #videoTasks = new Map<string, Task>();

  disconnectedCallback(): void {
    super.disconnectedCallback();

    for (const url of this.#blobUrls) {
      URL.revokeObjectURL(url);
    }

    for (const task of this.#videoTasks.values()) {
      task.abort();
    }

    this.#videoTasks.clear();
  }

  #renderVideoElement(videoUri: string) {
    let uri: string | null = videoUri;
    const isVertical = isShortsUri(uri);
    if (isWatchUri(uri) || isShortsUri(uri)) {
      uri = convertWatchOrShortsUriToEmbedUri(uri);
    } else if (isShareUri(uri)) {
      uri = convertShareUriToEmbedUri(uri);
    }

    if (isEmbedUri(uri)) {
      return html`<iframe
        class=${isVertical ? "vertical" : ""}
        src="${uri}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>`;
    } else {
      if (!uri) {
        return html`<p>Unable to obtain video.</p>`;
      }

      let videoTask = this.#videoTasks.get(uri);
      if (!videoTask) {
        videoTask = new Task(this, {
          task: async ([url]) => {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            this.#blobUrls.push(blobUrl);
            return blobUrl;
          },
          args: () => [uri!],
        });

        videoTask.autoRun = false;
        this.#videoTasks.set(uri, videoTask);
        videoTask.run();
      }

      return videoTask.render({
        initial: () =>
          html`<div class="loading-message">
            <span class="g-icon round rotate">progress_activity</span>
            Loading video…
          </div>`,
        pending: () =>
          html`<div class="loading-message">
            <span class="g-icon round rotate">progress_activity</span>
            Loading video…
          </div>`,
        complete: (blobUrl) => html`<video src=${blobUrl} controls></video>`,
        error: () => html`<p>Unable to load video.</p>`,
      });
    }
  }

  #renderVideo() {
    const fileUri = A2UI.v0_8.UI.Utils.extractStringValue(
      this.fileUri,
      this.component,
      this.processor,
      this.surfaceId
    );
    const url = A2UI.v0_8.UI.Utils.extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    const videoUrl = fileUri || url;
    if (!videoUrl) {
      return html`<p>Unable to obtain video.</p>`;
    }

    return this.#renderVideoElement(videoUrl);
  }

  render() {
    return html`<section>${this.#renderVideo()}</section>`;
  }
}
