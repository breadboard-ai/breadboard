/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { html, css, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { ResolvedImage } from "../types/types.js";
import { extractStringValue } from "./utils/utils.js";
import {
  triggerDownload,
  triggerClipboardCopy,
} from "./utils/image-helpers.js";
import { StateEvent } from "../events/events.js";
import { icons } from "../styles/icons.js";
import { classMap } from "lit/directives/class-map.js";

/**
 * Renders an image from a URL (literal or data-bound).
 *
 * Supports `usageHint` for semantic styling variants. The parent sets
 * `isMedia = true` in the render switch, allowing containers like Button
 * to detect image children.
 *
 * Overlay controls (copy-to-clipboard, download) appear on hover, positioned
 * at the bottom-right of the image.
 */
@customElement("a2ui-image")
export class Image extends Root {
  @property()
  accessor url: StringValue | null = null;

  @property()
  accessor usageHint: ResolvedImage["usageHint"] | null = null;

  @state()
  accessor #loaded = false;

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("url")) {
      this.#loaded = false;
    }
  }

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: hidden;
        padding: var(--a2ui-image-padding, 0);
      }

      section {
        border-radius: var(--a2ui-image-radius, 20px);
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      }

      #buttons {
        position: absolute;
        bottom: var(--a2ui-spacing-5, 16px);
        right: var(--a2ui-spacing-5, 16px);
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity var(--a2ui-transition-speed, 0.2s) ease;
      }

      section:hover #buttons {
        opacity: 1;
      }

      #buttons button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--a2ui-image-button-size, 36px);
        height: var(--a2ui-image-button-size, 36px);
        padding: 0;
        border: none;
        border-radius: var(--a2ui-border-radius, 10px);
        background: var(--a2ui-image-button-bg, oklch(0 0 0 / 0.5));
        color: var(--a2ui-image-button-color, white);
        cursor: pointer;
        transition: background var(--a2ui-transition-speed, 0.2s) ease;
      }

      #buttons button:hover {
        background: var(--a2ui-image-button-bg-hover, oklch(0 0 0 / 0.7));
      }

      img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: inherit;
        object-fit: cover;
      }

      img.loading {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .loading-message {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        aspect-ratio: 1;
        border-radius: inherit;
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

  #renderImage(imageUrl: string) {
    if (!imageUrl) {
      return nothing;
    }

    return html`${!this.#loaded
        ? html`<div class="loading-message">
            <span class="g-icon round rotate">progress_activity</span>
            Loading image…
          </div>`
        : nothing}
      <img
        class=${classMap({ loading: !this.#loaded })}
        src=${imageUrl}
        @load=${() => {
          this.#loaded = true;
        }}
      />`;
  }

  #renderControls(imageUrl: string) {
    if (!imageUrl) {
      return nothing;
    }

    return html`<div id="buttons">
      <button
        @click=${async (evt: Event) => {
          evt.stopImmediatePropagation();
          const id = crypto.randomUUID();
          this.#dispatchStatus(id, "Copying to clipboard\u2026", "pending");
          try {
            await triggerClipboardCopy(imageUrl);
            this.#dispatchStatus(id, "Copied to clipboard", "success");
          } catch {
            this.#dispatchStatus(id, "Failed to copy", "error");
          }
        }}
      >
        <span class="g-icon heavy round">content_copy</span>
      </button>
      <button
        @click=${async (evt: Event) => {
          evt.stopImmediatePropagation();
          const id = crypto.randomUUID();
          this.#dispatchStatus(id, "Preparing download\u2026", "pending");
          try {
            await triggerDownload(imageUrl);
            this.#dispatchStatus(id, "Download started", "success");
          } catch {
            this.#dispatchStatus(id, "Failed to download", "error");
          }
        }}
      >
        <span class="g-icon heavy round">download</span>
      </button>
    </div>`;
  }

  #dispatchStatus(
    id: ReturnType<typeof crypto.randomUUID>,
    message: string,
    status: "pending" | "success" | "error"
  ) {
    this.dispatchEvent(
      new StateEvent({
        eventType: "a2ui.status",
        id,
        message,
        status,
      })
    );
  }

  render() {
    const imageUrl = extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    return html`<section>
      ${this.#renderImage(imageUrl)} ${this.#renderControls(imageUrl)}
    </section>`;
  }
}
