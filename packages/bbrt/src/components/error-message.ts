/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { coercePresentableError } from "../util/presentable-error.js";

@customElement("bbrt-error-message")
export class BBRTErrorMessage extends LitElement {
  @property({ type: Object })
  accessor error: unknown;

  static override styles = css`
    :host {
      display: block;
    }
    :host::part(error) {
      background: #fff0ef;
      padding: 12px 16px;
      border-radius: 8px;
    }
    :host::part(message) {
      color: #960023;
    }
    :host::part(stack) {
      color: #5c5c5c;
    }
    :first-child {
      margin-top: 0;
    }
    :last-child {
      margin-bottom: 0;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
  `;

  override render() {
    return this.#renderError(this.error);
  }

  #renderError(error: unknown): unknown {
    const presentable = coercePresentableError(error);
    if (presentable.additional && presentable.additional.length > 0) {
      return [
        this.#renderError({ ...presentable, additional: undefined }),
        ...presentable.additional.map(this.#renderError),
      ];
    }
    if (presentable.stack) {
      return html`
        <div part="error">
          <pre part="message">${presentable.message ?? "Unknown error"}</pre>
          <pre part="stack">${presentable.stack}</pre>
        </div>
      `;
    }
    return html`<pre part="error message">${presentable.message}</pre>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-error-message": BBRTErrorMessage;
  }
}
