/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {BBRTConversation} from '../llm/conversation.js';

@customElement('bbrt-prompt')
export class BBRTPrompt extends LitElement {
  @property({attribute: false})
  conversation?: BBRTConversation;

  static override styles = css`
    :host {
      border-top: 1px solid #ccc;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    input {
      background: #f0f4f9;
      border: none;
      border-radius: 14px;
      margin: 0 24px;
      padding: 0 14px;
      height: 40px;
      flex: 1;
      font-family: Helvetica, sans-serif;
      font-size: 16px;
      font-weight: 400;
    }
  `;

  override render() {
    if (this.conversation === undefined) {
      return html`Connecting...`;
    }
    return html`<input
      type="text"
      placeholder="Ask BBRT"
      @keydown=${this.#onKeydown}
    />`;
  }

  #onKeydown(event: KeyboardEvent & {target: HTMLInputElement}) {
    if (event.key !== 'Enter') {
      return;
    }
    if (event.shiftKey) {
      return;
    }
    if (this.conversation === undefined) {
      return;
    }
    const input = event.target;
    this.conversation.send(input.value);
    input.value = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-prompt': BBRTPrompt;
  }
}
