/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalWatcher} from '@lit-labs/signals';
import {LitElement, css, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {BBRTTurn} from '../llm/conversation.js';
import {typingEffect} from '../util/typing-effect.js';
import './error-message.js';
import './markdown.js';
import './tool-call.js';

@customElement('bbrt-chat-message')
export class BBRTChatMessage extends SignalWatcher(LitElement) {
  @property({type: Object})
  turn?: BBRTTurn;

  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 20px;
      font-family: Helvetica, sans-serif;
    }
    :host::part(icon) {
      width: 24px;
      aspect-ratio: 1;
      /* Slightly better align with the first line of text. */
      margin-top: -2px;
    }
    :host::part(icon-user) {
      color: #678592;
    }
    :host::part(icon-model) {
      color: #52e5ad;
    }
    :host::part(content) {
      overflow-y: auto;
    }
    :host > :last-child {
      /* We put this here rather than on :host so that we don't have a margin
      when we have no content. */
      margin-bottom: 20px;
    }
  `;

  override render() {
    switch (this.turn?.kind) {
      case undefined: {
        return nothing;
      }
      case 'user-content': {
        return [this.#roleIcon(this.turn.role), this.turn.content];
      }
      case 'user-tool-response': {
        return nothing;
      }
      case 'model': {
        const text =
          typeof this.turn.content === 'string'
            ? this.turn.content
            : typingEffect(1000, this.turn.content);
        return [
          this.#roleIcon(this.turn.role),
          html`<div part="contents">
            <bbrt-markdown .markdown=${text} part="content"></bbrt-markdown>
            ${this.turn.toolCalls?.length
              ? html`<div id="toolCalls" part="content">
                  ${this.turn.toolCalls?.map(
                    (toolCall) =>
                      html`<bbrt-tool-call
                        .toolCall=${toolCall}
                      ></bbrt-tool-call>`,
                  ) ?? []}
                </div>`
              : ''}
          </div>`,
        ];
      }
      case 'error': {
        return [
          this.#roleIcon(this.turn.role),
          html`<div part="contents">
            <bbrt-error-message
              part="content"
              .error=${this.turn.error}
            ></bbrt-error-message>
          </div>`,
        ];
      }
      default: {
        this.turn satisfies never;
        return nothing;
      }
    }
  }

  #roleIcon(role: 'user' | 'model') {
    if (role !== 'user' && role !== 'model') {
      return '';
    }
    return html`<svg aria-label="${role}" role="img" part="icon icon-${role}">
      <use href="/images/${role}.svg#icon"></use>
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat-message': BBRTChatMessage;
  }
}
