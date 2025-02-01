/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type { LLMContent } from "@breadboard-ai/types";
import { isInlineData, isTextCapabilityPart } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { renderMarkdownToHtmlString } from "../../directives/markdown.js";
import { ToastEvent, ToastType } from "../../events/events.js";
import { toolbarStyles } from "../../styles/toolbar-styles.js";
import { tokenVendorContext } from "../elements.js";
import { appendToDocUsingDriveKit } from "../google-drive/append-to-doc-using-drive-kit.js";
import { classMap } from "lit/directives/class-map.js";

const CAN_COPY = "ClipboardItem" in window;

@customElement("bb-export-toolbar")
export class ExportToolbar extends LitElement {
  @property({ type: Object })
  accessor value: LLMContent | null = null;

  @consume({ context: tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

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
    return html`
      <div class="bb-toolbar">
        <button
          id="drive"
          class=${classMap({ running: this._savingToDrive })}
          @click=${this.#clickDrive}
        >
          Save to Drive
        </button>
        ${CAN_COPY
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

    let htmlText = "";
    for (const part of this.value.parts) {
      if (isTextCapabilityPart(part)) {
        htmlText += renderMarkdownToHtmlString(part.text);
      } else if (isInlineData(part)) {
        const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        htmlText += `<img src="${dataURL}" />`;
      }
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([htmlText], {
          type: "text/html",
        }),
      }),
    ]);

    this.dispatchEvent(
      new ToastEvent("Copied to Clipboard", ToastType.INFORMATION)
    );
  }

  async #clickDrive() {
    if (!this.value) {
      this.dispatchEvent(
        new ToastEvent(
          "Internal error saving to Google Drive: No value",
          ToastType.ERROR
        )
      );
      return;
    }
    if (!this.tokenVendor) {
      this.dispatchEvent(
        new ToastEvent(
          "Internal error saving to Google Drive: No token vendor",
          ToastType.ERROR
        )
      );
      return;
    }
    if (this._savingToDrive) {
      return;
    }

    this._savingToDrive = true;
    try {
      const { url } = await appendToDocUsingDriveKit(
        this.value,
        `Breadboard Demo (${new Date().toLocaleDateString("en-US")})`,
        this.tokenVendor
      );
      this.dispatchEvent(
        new ToastEvent(
          // HACK: Toast messages are typed to only allow strings, but actually
          // they just directly render the value, so a TemplateResult works too,
          // letting us embed a link.
          html`Saved to
            <a href=${url} target="_blank">Google Doc</a>` as unknown as string,
          ToastType.INFORMATION
        )
      );
    } catch (error) {
      this.dispatchEvent(
        new ToastEvent(
          typeof error === "object" && "message" in (error as Error)
            ? (error as Error).message
            : JSON.stringify(error),
          ToastType.ERROR
        )
      );
    }
    this._savingToDrive = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-export-toolbar": ExportToolbar;
  }
}
