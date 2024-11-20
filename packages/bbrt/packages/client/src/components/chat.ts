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

type ScrollState = {status: 'locked'} | {status: 'auto'; intervalId: number};

@customElement('bbrt-chat')
export class BBRTChat extends SignalWatcher(LitElement) {
  @property({attribute: false})
  conversation?: BBRTConversation;

  #scrollState: ScrollState;

  static override styles = css`
    :host {
      padding: 16px;
      overflow-y: auto;
      background: #fafdff;
    }
  `;

  constructor() {
    super();

    // TODO(aomarks) Turn auto-scrolling into a directive. Also, be a smarter
    // scroller.
    const autoScroll = () =>
      setInterval(() => {
        this.scrollTo({top: Number.MAX_SAFE_INTEGER, behavior: 'smooth'});
      }, 500);
    this.#scrollState = {
      status: 'auto',
      intervalId: autoScroll(),
    };
    let prevScrollTop = 0;
    this.addEventListener('scroll', () => {
      const scrolledUp = this.scrollTop < prevScrollTop;
      if (this.#scrollState.status === 'auto') {
        if (scrolledUp) {
          clearInterval(this.#scrollState.intervalId);
          this.#scrollState = {status: 'locked'};
        }
      } else {
        const scrolledToBottom =
          this.scrollTop + this.clientHeight >= this.scrollHeight;
        if (scrolledToBottom) {
          this.#scrollState = {status: 'auto', intervalId: autoScroll()};
        }
      }
      prevScrollTop = this.scrollTop;
    });
  }

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
