/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CutEvent, ForkEvent, RetryEvent } from "../llm/events.js";
import type { ReactiveTurnState } from "../state/turn.js";
import { iconButtonStyle } from "../style/icon-button.js";
import { connectedEffect } from "../util/connected-effect.js";
import "./markdown.js";
import "./tool-call.js";

export interface TurnInfo {
  turn: ReactiveTurnState;
  index: number;
  numTurnsTotal: number;
  hideIcon: boolean;
}

@customElement("bbrt-chat-message")
export class BBRTChatMessage extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor info: TurnInfo | undefined = undefined;

  static override styles = [
    iconButtonStyle,
    css`
      :host {
        --icon-size: 24px;
        display: grid;
        grid-template-areas:
          "icon pad main"
          "left pad main"
          "left pad footer";
        grid-template-columns: var(--icon-size) 16px 1fr;
        grid-template-rows: min-content 1fr;
        font-family: Helvetica, sans-serif;
        position: relative;
      }
      :host::part(icon) {
        grid-area: icon;
        width: var(--icon-size);
        aspect-ratio: 1;
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
        grid-area: main;
      }

      :host::part(content) {
        overflow-x: auto;
      }
      :host > :last-child {
        /* We put this here rather than on :host so that we don't have a margin
        when we have no content. */
        margin-bottom: 20px;
      }
      #toolCalls > bbrt-tool-call:not(:first-child) {
        margin-top: 20px;
      }
      #actions {
        grid-area: footer;
        opacity: 0%;
        height: min-content;
        width: min-content;
        position: relative;
        margin: 4px auto 12px -10px;
        display: flex;
      }
      :host(:hover) #actions,
      :host(:focus) #actions,
      :host(:last-of-type[status="done"]) #actions {
        opacity: 30%;
      }
      :host #actions:hover,
      :host #actions:focus {
        opacity: 100% !important;
      }
      #actions button {
        border: none;
        --bb-icon-size: 20px;
      }
      #retryButton {
        --bb-icon: var(--bb-icon-refresh);
      }
      #forkButton {
        --bb-icon: var(--bb-icon-fork-down-right);
      }
      #cutButton {
        --bb-icon: var(--bb-icon-content-cut);
      }
      #actions button:not(:hover) {
        --bb-button-background: transparent;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    connectedEffect(this, () =>
      this.setAttribute("status", this.info?.turn.status ?? "pending")
    );
  }

  override render() {
    if (!this.info) {
      return nothing;
    }
    return [
      this.#roleIcon,
      html`
        <div part="contents">
          <bbrt-markdown
            .markdown=${this.info.turn.partialText}
            part="content"
          ></bbrt-markdown>
          ${this.#renderFunctionCalls()}
        </div>
      `,
      this.#actions,
    ];
  }

  #renderFunctionCalls() {
    const calls = this.info?.turn.partialFunctionCalls;
    if (!calls?.length) {
      return nothing;
    }
    return html`<div id="toolCalls" part="content">
      ${calls.map(
        (call) => html`<bbrt-tool-call .toolCall=${call}></bbrt-tool-call>`
      )}
    </div>`;
  }

  get #roleIcon() {
    if (!this.info || this.info.hideIcon) {
      return nothing;
    }
    const role = this.info.hideIcon ? undefined : this.info.turn.role;
    return html`<svg
      aria-label="${role}"
      role="img"
      part="icon icon-${role} icon-${this.info.turn.status}"
    >
      ${role ? svg`<use href="/bbrt/images/${role}.svg#icon"></use>` : nothing}
    </svg>`;
  }

  get #actions() {
    if (!this.info) {
      return nothing;
    }
    const buttons = [];
    if (this.info.turn.role === "user") {
      buttons.push(html`
        <button
          id="retryButton"
          class="bb-icon-button"
          title="Retry"
          @click=${this.#onClickRetryButton}
        ></button>
      `);
    }
    if (
      this.info.turn.role === "model" &&
      this.info.turn.status === "done" &&
      // If the turn has function calls, we don't allow splicing, because it is
      // expected that there is always another turn to come, so the cut should
      // happen there instead.
      this.info.turn.partialFunctionCalls.length === 0 &&
      // No reason to splice if we're already at the end.
      this.info.index < this.info.numTurnsTotal - 1
    ) {
      buttons.push(html`
        <button
          id="cutButton"
          class="bb-icon-button"
          title="Cut"
          @click=${this.#onClickCutButton}
          ></button>
        <button
          id="forkButton"
          class="bb-icon-button"
          title="Fork"
          @click=${this.#onClickForkButton}
          ></button>
        </div>`);
    }
    return html`<div id="actions">${buttons}</div>`;
  }

  #onClickCutButton() {
    if (!this.info) {
      return;
    }
    this.dispatchEvent(new CutEvent(this.info.turn));
  }

  #onClickForkButton() {
    if (!this.info) {
      return;
    }
    this.dispatchEvent(new ForkEvent(this.info.turn));
  }

  #onClickRetryButton() {
    if (!this.info) {
      return;
    }
    this.dispatchEvent(new RetryEvent(this.info.turn));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-chat-message": BBRTChatMessage;
  }
}
