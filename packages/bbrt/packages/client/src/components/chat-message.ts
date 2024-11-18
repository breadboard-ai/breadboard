/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {StreamableContent} from '../llm/conversation.js';
import {typingEffect} from '../util/typing-effect.js';
import './markdown.js';

@customElement('bbrt-chat-message')
export class BBRTChatMessage extends LitElement {
  @property({type: Object})
  data?: StreamableContent;

  static override styles = css`
    :host {
      display: block;
      margin-bottom: 20px;
      font-family: Helvetica, sans-serif;
    }
  `;

  override render() {
    if (this.data === undefined) {
      return html`Connecting ...`;
    }
    const text =
      typeof this.data.text === 'string'
        ? this.data.text
        : typingEffect(1000, this.data.text);
    return html`<b>${this.data.role}</b>:
      <bbrt-markdown .markdown=${text}></bbrt-markdown>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat-message': BBRTChatMessage;
  }
}
