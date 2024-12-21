/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Conversation } from "../llm/conversation.js";

@customElement("bbrt-prompt")
export class BBRTPrompt extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor conversation: Conversation | undefined = undefined;

  static override styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    input {
      background: #f0f4f9;
      border: none;
      border-radius: 14px;
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
      placeholder="Ask me about Breadboard"
      @keydown=${this.#onKeydown}
    />`;
  }

  #onKeydown(event: KeyboardEvent & { target: HTMLInputElement }) {
    if (
      !(
        event.key === "Enter" &&
        !event.shiftKey &&
        this.conversation?.status === "ready" &&
        event.target.value
      )
    ) {
      return;
    }
    const input = event.target;
    void this.conversation.send(input.value);
    input.value = "";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-prompt": BBRTPrompt;
  }
}
