/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { buttonStyle } from "../style/button.js";
import "./markdown.js";

@customElement("bbrt-markdown-viewer")
export class BBRTMarkdownViewer extends LitElement {
  @property({ reflect: false })
  accessor markdown: string | undefined = undefined;

  @property({ reflect: true })
  accessor mode: "markdown" | "preview" = "preview";

  static override styles = [
    buttonStyle,
    css`
      :host {
        padding: 20px;
        display: flex;
        flex-direction: column;
      }
      #toggle-mode-button {
        align-self: flex-end;
        cursor: pointer;
        margin-bottom: 20px;
        min-width: 137px;
      }
      :host([mode="markdown"]) #toggle-mode-button {
        --bb-icon: var(--bb-icon-preview);
      }
      :host([mode="preview"]) #toggle-mode-button {
        --bb-icon: var(--bb-icon-edit);
      }
      textarea,
      bbrt-markdown {
        flex: 1;
        overflow: auto;
        color: var(--bb-neutral-800, black);
        border: 1px solid var(--bb-neutral-200);
        border-radius: 10px;
        padding: 20px;
      }
      textarea {
        resize: none;
        white-space: pre-wrap;
        background: transparent;
      }
      textarea[disabled] {
        /* Cancel the weird default thing where for a disabled textarea you can
      select text, but the cursor is a pointer instead of a caret. */
        cursor: unset;
      }
    `,
  ];

  override render() {
    return [
      html`<button
        id="toggle-mode-button"
        class="bb-button"
        @click=${this.#toggle}
      >
        ${this.mode === "preview" ? "View Source" : "View Preview"}
      </button>`,
      this.mode === "preview"
        ? html`<bbrt-markdown .markdown=${this.markdown}></bbrt-markdown>`
        : html`<textarea disabled>${this.markdown}</textarea>`,
    ];
  }

  #toggle() {
    this.mode = this.mode === "markdown" ? "preview" : "markdown";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-markdown-viewer": BBRTMarkdownViewer;
  }
}
