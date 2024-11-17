/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Config} from '../config.js';
import {Conversation} from '../llm/conversation.js';
import './artifacts.js';
import './chat.js';
import './prompt.js';

@customElement('bbrt-main')
export class BBRTMain extends LitElement {
  @property({type: Object})
  config?: Config;

  #conversation = new Conversation();

  static override styles = css`
    :host {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr 100px;
    }
    bbrt-chat {
      grid-column: 1;
      grid-row: 1 / 2;
    }
    bbrt-prompt {
      grid-column: 1;
      grid-row: 2;
    }
    bbrt-artifacts {
      grid-column: 2;
      grid-row: 1 / 3;
    }
  `;

  override render() {
    return html`
      <bbrt-chat .conversation=${this.#conversation}></bbrt-chat>
      <bbrt-prompt .conversation=${this.#conversation}></bbrt-prompt>
      <bbrt-artifacts></bbrt-artifacts>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-main': BBRTMain;
  }
}
