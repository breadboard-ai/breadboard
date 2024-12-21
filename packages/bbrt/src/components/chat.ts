/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Conversation } from "../llm/conversation.js";
import "./chat-message.js";
import { ScrollController } from "./scroll-controller.js";

@customElement("bbrt-chat")
export class BBRTChat extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor conversation: Conversation | undefined = undefined;

  static override styles = css`
    :host {
      display: block;
      padding: 16px;
      overflow-y: auto;
      background: #fafdff;
    }
  `;

  constructor() {
    super();
    new ScrollController(this, this);
  }

  override render() {
    if (this.conversation === undefined) {
      return html`Connecting...`;
    }
    const turns = this.conversation.turns;
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
            turn.role === turns[i - 1]?.role
          }
        ></bbrt-chat-message>`
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-chat": BBRTChat;
  }
}
