/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {BBRTToolCall} from '../llm/conversation.js';

@customElement('bbrt-tool-call')
export class BBRTToolCallEl extends LitElement {
  @property({attribute: false})
  toolCall?: BBRTToolCall;

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      font-family: Helvetica, sans-serif;
      border-radius: 8px;
      padding: 8px;
      border: 1px solid #009ac8;
      margin-right: 16px;
    }
    img {
      max-width: 24px;
      max-height: 24px;
      margin-right: 8px;
    }
  `;

  override render() {
    if (this.toolCall === undefined) {
      return nothing;
    }
    return html`
      <img .src=${this.toolCall.tool.icon} />
      ${this.toolCall.tool.render(this.toolCall.args)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-tool-call': BBRTToolCallEl;
  }
}
