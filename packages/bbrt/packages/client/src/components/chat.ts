/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalWatcher} from '@lit-labs/signals';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {BBRTConversation} from '../llm/conversation.js';
import './chat-message.js';

@customElement('bbrt-chat')
export class BBRTChat extends SignalWatcher(LitElement) {
  @property({attribute: false})
  conversation?: BBRTConversation;

  static override styles = css`
    :host {
      padding: 16px;
      overflow-y: auto;
      background: #fafdff;
    }
  `;

  override render() {
    if (this.conversation === undefined) {
      return html`Connecting...`;
    }
    return this.conversation.turns.map(
      (turn) => html`<bbrt-chat-message .turn=${turn}></bbrt-chat-message>`,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat': BBRTChat;
  }
}
