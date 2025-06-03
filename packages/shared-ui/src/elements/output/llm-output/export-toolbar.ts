/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type { LLMContent } from "@breadboard-ai/types";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { renderMarkdownToHtmlString } from "../../../directives/markdown.js";
import { ToastEvent, ToastType } from "../../../events/events.js";
import { toolbarStyles } from "../../../styles/toolbar-styles.js";
import { tokenVendorContext } from "../../elements.js";
import { classMap } from "lit/directives/class-map.js";

const CAN_COPY = "ClipboardItem" in window;

@customElement("bb-export-toolbar")
export class ExportToolbar extends LitElement {
  @property()
  accessor graphUrl: URL | null = null;

  @property({ type: Object })
  accessor value: LLMContent | null = null;

  @consume({ context: tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

  @property({ type: Object })
  accessor supported = {
    drive: false,
    clipboard: false,
  };

  @state()
  private accessor _savingToDrive = false;

  static override styles = [
    toolbarStyles,
    css`
      #copy {
        --bb-icon: var(--bb-icon-copy-to-clipboard);
      }

      #drive {
        --bb-icon: var(--bb-icon-google-drive-outline);
        &.running {
          --bb-icon: url(/images/progress-ui.svg);
        }
      }
    `,
  ];

  override render() {
    if (Object.values(this.supported).every((v) => !v)) {
      return nothing;
    }

    return html`
      <div class="bb-toolbar">
        ${this.supported.drive
          ? html`<button
              id="drive"
              class=${classMap({ running: this._savingToDrive })}
              @click=${this.#clickDrive}
            >
              Save to Drive
            </button>`
          : nothing}
        ${CAN_COPY && this.supported.clipboard
          ? html`<button id="copy" @click=${this.#clickCopy}>Copy all</button>`
          : nothing}
      </div>
    `;
  }

  async #clickCopy() {
    if (!this.value) {
      console.error("Error copying: No value");
      return;
    }

    let plainText = "";
    let htmlText = "";
    for (const part of this.value.parts) {
      if (isTextCapabilityPart(part)) {
        plainText += part.text + "\n\n";
        htmlText += renderMarkdownToHtmlString(part.text);
      } else if (isInlineData(part)) {
        const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        htmlText += `<img src="${dataURL}" />`;
        if (part.inlineData.mimeType.startsWith("text")) {
          plainText += part.inlineData.data + "\n\n";
        }
      } else if (isStoredData(part)) {
        if (part.storedData.mimeType.startsWith("text")) {
          let url = part.storedData.handle;
          if (url.startsWith(".") && this.graphUrl) {
            url = new URL(url, this.graphUrl).href;
          }

          const response = await fetch(url);
          const text = await response.text();
          plainText += text + "\n\n";
          htmlText += `<pre>${text}</pre>`;
        }
      } else if (isFileDataCapabilityPart(part)) {
        htmlText += `<a href="${part.fileData.fileUri}">${part.fileData.fileUri}</a>`;
        plainText += part.fileData.fileUri + "\n\n";
      }
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([htmlText], {
          type: "text/html",
        }),
        "text/plain": new Blob([plainText.trim()], {
          type: "text/plain",
        }),
      }),
    ]);

    this.dispatchEvent(
      new ToastEvent("Copied to Clipboard", ToastType.INFORMATION)
    );
  }

  async #clickDrive() {
    this.dispatchEvent(
      new ToastEvent("Saving to Google Drive is not supported", ToastType.ERROR)
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-export-toolbar": ExportToolbar;
  }
}
