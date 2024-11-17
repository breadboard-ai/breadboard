/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {asyncAppend} from 'lit/directives/async-append.js';
import type {StreamableContent} from '../llm/conversation.js';
import {typingEffect} from '../util/typing-effect.js';

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
    return html`<b>${this.data.role}</b>:
      ${typeof this.data.text === 'string'
        ? this.data.text
        : asyncAppend(typingEffect(3, this.data.text))}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat-message': BBRTChatMessage;
  }
}
