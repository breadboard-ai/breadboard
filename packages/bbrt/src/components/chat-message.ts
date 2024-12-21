/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ReactiveTurnState } from "../state/turn.js";
import "./error-message.js";
import "./markdown.js";
import "./tool-call.js";

@customElement("bbrt-chat-message")
export class BBRTChatMessage extends SignalWatcher(LitElement) {
  @property({ type: Object })
  accessor turn: ReactiveTurnState | undefined = undefined;

  @property({ type: Boolean })
  accessor hideIcon = false;

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

    #toolCalls,
    #toolResponses {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fill, 300px);
      /* Space for shadows to breathe on the bottom row. */
      padding-bottom: 5px;
    }
    #toolResponses > img {
      max-width: 100%;
    }
  `;

  override render() {
    // return html`<pre>${JSON.stringify(this.turn?.data ?? {}, null, 2)}</pre>`;
    if (!this.turn) {
      return nothing;
    }
    return [
      this.#roleIcon,
      html`
        <div part="contents">
          <bbrt-markdown
            .markdown=${this.turn.partialText}
            part="content"
          ></bbrt-markdown>
        </div>
      `,
      this.#renderFunctionCalls(),
    ];
  }

  #renderFunctionCalls() {
    const calls = this.turn?.partialFunctionCalls;
    if (!calls?.length) {
      return nothing;
    }
    return html`<div id="toolCalls" part="content">
      ${calls.map((call) =>
        call.render
          ? call.render()
          : html`<bbrt-tool-call .toolCall=${call}></bbrt-tool-call>`
      )}
    </div>`;
  }

  get #roleIcon() {
    if (!this.turn || this.hideIcon) {
      return nothing;
    }
    const role = this.turn.role;
    return html`<svg
      aria-label="${role}"
      role="img"
      part="icon icon-${role} icon-${this.turn.status}"
    >
      <use href="/bbrt/images/${role}.svg#icon"></use>
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-chat-message": BBRTChatMessage;
  }
}
