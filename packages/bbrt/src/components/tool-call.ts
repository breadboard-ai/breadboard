/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { BBRTToolCall } from "../llm/conversation.js";

@customElement("bbrt-tool-call")
export class BBRTToolCallEl extends LitElement {
  @property({ attribute: false })
  toolCall?: BBRTToolCall;

  static override styles = css`
    :host {
      background: #fff;
      display: inline-flex;
      align-items: flex-start;
      font-family: Helvetica, sans-serif;
      border-radius: 8px;
      padding: 10px 14px;
      border: 1px solid #d9d9d9;
      box-shadow: rgba(0, 0, 0, 0.1) 1px 1px 5px;
    }
    img {
      width: 40px;
      max-height: 100%;
    }
    :host::part(tool-call-content) {
      display: flex;
      flex-direction: column;
      padding: 0 0 0 16px;
      line-height: 1.4;
    }
    [part~="tool-call-content"] > :last-child {
      margin-bottom: 0;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
  `;

  override render() {
    if (this.toolCall === undefined) {
      return nothing;
    }
    return html`
      <img .src=${this.toolCall.tool.icon} />
      <div part="tool-call-content">
        ${this.toolCall.tool.renderCard(this.toolCall.args)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-tool-call": BBRTToolCallEl;
  }
}
