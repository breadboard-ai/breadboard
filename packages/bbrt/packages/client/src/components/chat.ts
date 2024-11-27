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
    const turns = this.conversation.turns;
    // .filter(({kind}) => kind !== 'user-tool-responses');
    return this.conversation.turns.map(
      (turn, i) =>
        html`<bbrt-chat-message
          .turn=${turn}
          .hideIcon=${
            // Hide the icon if the previous turn role was the same (since
            // otherwise we see two of the same icons in a row, which looks
            // weird).
            // TODO(aomarks) Some kind of visual indication would
            // actually be nice, though, because it's ambiguous sometimes if
            // e.g. one turn had multiple tool calls, or there was a sequence of
            // tool calls.
            turn.role === turns[i - 1]?.role ||
            // TODO(aomarks) Maybe just get rid of error turn, and put errors on
            // the turns they are associated with?
            turn.kind === 'error'
          }
        ></bbrt-chat-message>`,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat': BBRTChat;
  }
}
