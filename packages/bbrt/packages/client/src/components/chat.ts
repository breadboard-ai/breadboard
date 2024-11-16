/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

export interface MessageData {
  role: 'user' | 'bot';
  text: string;
}

@customElement('bbrt-chat')
export class BBRTChat extends LitElement {
  static override styles = css`
    :host {
      background-color: cream;
      padding: 16px;
    }
  `;
  override render() {
    const dummyMessage1: MessageData = {
      role: 'user',
      text: 'Hello',
    };
    const dummyMessage2: MessageData = {
      role: 'bot',
      text: 'Hello, how can I help you?',
    };
    return html`
      <bbrt-chat-message .data=${dummyMessage1}></bbrt-chat-message>
      <bbrt-chat-message .data=${dummyMessage2}></bbrt-chat-message>
    `;
  }
}

@customElement('bbrt-chat-message')
export class BBRTChatMessage extends LitElement {
  @property({type: Object})
  data!: MessageData;

  static override styles = css`
    :host {
      display: block;
      margin-bottom: 20px;
      font-family: 'Helvetica', sans-serif;
    }
  `;

  override render() {
    return html`<b>${this.data.role}</b>: ${this.data.text}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat': BBRTChat;
  }
}
