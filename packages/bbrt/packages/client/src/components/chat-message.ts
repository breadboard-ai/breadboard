/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Turn} from '../llm/conversation.js';
import {typingEffect} from '../util/typing-effect.js';
import './error-message.js';
import './markdown.js';

@customElement('bbrt-chat-message')
export class BBRTChatMessage extends LitElement {
  @property({type: Object})
  turn?: Turn;

  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 20px;
      margin-bottom: 20px;
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
    [part~='message'] {
      overflow-y: auto;
    }
  `;

  override render() {
    switch (this.turn?.kind) {
      case undefined: {
        return nothing;
      }
      case 'error': {
        return [
          this.#roleIcon(this.turn.role),
          html`<bbrt-error-message
            part="message"
            .error=${this.turn.error}
          ></bbrt-error-message>`,
        ];
      }
      case 'text': {
        const text =
          typeof this.turn.text === 'string'
            ? this.turn.text
            : typingEffect(1000, this.turn.text);
        return [
          this.#roleIcon(this.turn.role),
          html`<bbrt-markdown
            .markdown=${text}
            part="message"
          ></bbrt-markdown>`,
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
