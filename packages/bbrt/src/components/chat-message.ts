/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CutEvent, EditEvent, ForkEvent, RetryEvent } from "../llm/events.js";
import type { ReactiveTurnState } from "../state/turn.js";
import { iconButtonStyle } from "../style/icon-button.js";
import { connectedEffect } from "../util/connected-effect.js";
import "./error-message.js";
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
        --pad-size: 24px;
        font-family: Helvetica, sans-serif;
        position: relative;
        display: grid;
        grid-template-areas:
          "icon pad markdown"
          "icon pad toolcalls"
          "icon pad errors"
          "icon pad actions";
        grid-template-columns: var(--icon-size) var(--pad-size) 1fr;
        grid-template-rows: min-content;
      }
      :host::part(icon) {
        grid-area: icon;
      }
      :host::part(markdown) {
        grid-area: markdown;
        overflow-x: auto;
      }
      :host::part(toolcalls) {
        grid-area: toolcalls;
        overflow-x: auto;
      }
      :host::part(errors) {
        grid-area: errors;
        overflow-x: auto;
      }
      :host::part(actions) {
        grid-area: actions;
        overflow-x: auto;
      }

      bbrt-tool-call:not(:first-child) {
        margin-top: 20px;
      }

      /* Icon styling */
      :host::part(icon) {
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
        animation: throb 0.5s infinite;
      }
      :host::part(icon-using-tools) {
        animation: throb 1s infinite;
      }
      :host::part(icon-done) {
        animation: throb 0.5s 1;
      }
      :host::part(icon-hide) {
        opacity: 20%;
        scale: 50%;
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

      /* Action buttons */
      #actions {
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
      #actions:hover,
      #actions:focus {
        opacity: 100% !important;
      }
      :host::part(action) {
        border: none;
        --bb-icon-size: 20px;
      }
      :host::part(action):not(:hover) {
        --bb-button-background: transparent;
      }

      /* Button icons */
      #editButton {
        --bb-icon: var(--bb-icon-edit);
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
      this.#renderRoleIcon(),
      this.#renderMarkdown(),
      this.#renderToolCalls(),
      this.#renderErrors(),
      this.#renderActions(),
    ];
  }

  #renderRoleIcon() {
    if (!this.info) {
      return nothing;
    }
    const role = this.info.turn.role;
    return html`<svg
      aria-label="${role}"
      role="img"
      part="icon icon-${role} icon-${this.info.turn.status} ${this.info.hideIcon
        ? "icon-hide"
        : ""}"
    >
      <use href="/bbrt/images/${role}.svg#icon"></use>
    </svg>`;
  }

  #renderMarkdown() {
    if (!this.info?.turn.partialText) {
      return nothing;
    }
    return html`
      <bbrt-markdown
        part="markdown"
        .markdown=${this.info.turn.partialText}
      ></bbrt-markdown>
    `;
  }

  #renderToolCalls() {
    const calls = this.info?.turn.partialFunctionCalls;
    if (!calls?.length) {
      return nothing;
    }
    return html`<div part="toolcalls">
      ${calls.map(
        (call) =>
          html`<bbrt-tool-call
            part="toolcall"
            .toolCall=${call}
          ></bbrt-tool-call>`
      )}
    </div>`;
  }

  #renderErrors() {
    const errors = this.info?.turn.partialErrors;
    if (!errors?.length) {
      return nothing;
    }
    return html`<div part="errors">
      ${errors.map(
        ({ error }) =>
          html`<bbrt-error-message
            part="error"
            .error=${error}
          ></bbrt-error-message>`
      )}
    </div>`;
  }

  #renderActions() {
    if (!this.info) {
      return nothing;
    }
    const buttons = [];
    if (this.info.turn.role === "user") {
      buttons.push(html`
        <button
          id="editButton"
          part="action"
          class="bb-icon-button"
          title="Edit"
          @click=${this.#onClickEditButton}
        ></button>
        <button
          id="retryButton"
          part="action"
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
          part="action"
          class="bb-icon-button"
          title="Cut"
          @click=${this.#onClickCutButton}
          ></button>
        <button
          part="action"
          id="forkButton"
          class="bb-icon-button"
          title="Fork"
          @click=${this.#onClickForkButton}
          ></button>
        </div>`);
    }
    return html`<div id="actions" part="actions">${buttons}</div>`;
  }

  #onClickEditButton() {
    if (!this.info) {
      return;
    }
    this.dispatchEvent(new EditEvent(this.info.turn));
  }

  #onClickRetryButton() {
    if (!this.info) {
      return;
    }
    this.dispatchEvent(new RetryEvent(this.info.turn));
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
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-chat-message": BBRTChatMessage;
  }
}
