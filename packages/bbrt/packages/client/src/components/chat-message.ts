/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalWatcher} from '@lit-labs/signals';
import {LitElement, css, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {guard} from 'lit/directives/guard.js';
import type {BBRTTurn} from '../llm/conversation.js';
import {typingEffect} from '../util/typing-effect.js';
import './error-message.js';
import './markdown.js';
import './tool-call.js';

@customElement('bbrt-chat-message')
export class BBRTChatMessage extends SignalWatcher(LitElement) {
  @property({type: Object})
  turn?: BBRTTurn;

  @property({type: Boolean})
  hideIcon = false;

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

    :host::part(icon-pending) {
      animation: throb 3s infinite;
    }
    :host::part(icon-streaming) {
      /* TODO(aomarks) Make throbber reflect the speed of the stream. */
      animation: throb 0.5s infinite;
    }
    :host::part(icon-using-tools) {
      animation: throb 1s infinite;
    }
    :host::part(icon-done) {
      animation: throb 0.5s 1;
    }

    @keyframes throb {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.3);
      }
    }

    :host::part(content) {
      overflow-x: auto;
    }
    :host::part(contents) {
      overflow-x: auto;
    }
    :host::part(content) {
      overflow-x: auto;
    }
    :host > :last-child {
      /* We put this here rather than on :host so that we don't have a margin
      when we have no content. */
      margin-bottom: 20px;
    }

    #toolCalls {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fill, 250px);
      /* Space for shadows to breath on the bottom row. */
      padding-bottom: 5px;
    }
  `;

  override render() {
    const turn = this.turn;
    switch (turn?.kind) {
      case undefined: {
        return nothing;
      }
      case 'user-content': {
        return [this.#roleIcon, turn.content];
      }
      case 'user-tool-responses': {
        return nothing;
      }
      case 'model': {
        const content =
          typeof turn.content === 'string'
            ? turn.content
            : guard(turn.content, () => typingEffect(5, turn.content));
        const toolCalls = turn.toolCalls?.length
          ? html`<div id="toolCalls" part="content">
              ${turn.toolCalls?.map(
                (toolCall) =>
                  html`<bbrt-tool-call .toolCall=${toolCall}></bbrt-tool-call>`,
              ) ?? []}
            </div>`
          : '';
        return [
          this.#roleIcon,
          html`<div part="contents">
            <bbrt-markdown .markdown=${content} part="content"></bbrt-markdown>
            ${toolCalls}
          </div>`,
        ];
      }
      case 'error': {
        return [
          this.#roleIcon,
          html`<div part="contents">
            <bbrt-error-message
              part="content"
              .error=${turn.error}
            ></bbrt-error-message>
          </div>`,
        ];
      }
      default: {
        turn satisfies never;
        return nothing;
      }
    }
  }

  get #roleIcon() {
    if (!this.turn) {
      return nothing;
    }
    const {role, status} = this.turn;
    if (!(role == 'user' || role == 'model')) {
      return '';
    }
    if (this.hideIcon) {
      return html`<span part="icon"></span>`;
    }
    return html`<svg
      aria-label="${role}"
      role="img"
      part="icon icon-${role} icon-${status.get()}"
    >
      <use href="/images/${role}.svg#icon"></use>
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-chat-message': BBRTChatMessage;
  }
}
