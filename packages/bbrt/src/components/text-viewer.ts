/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bbrt-text-viewer")
export class BBRTTextViewer extends LitElement {
  @property({ attribute: false })
  accessor text: string | undefined = undefined;

  static override styles = css`
    :host {
      padding: 20px;
      display: flex;
    }
    textarea {
      white-space: pre-wrap;
      color: var(--bb-neutral-800, black);
      font-size: 1.1em;
      line-height: 1.4em;
      cursor: unset;
      flex: 1;
      resize: none;
    }
  `;

  override render() {
    return html`<textarea disabled>${this.text ?? ""}</textarea>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-text-viewer": BBRTTextViewer;
  }
}
