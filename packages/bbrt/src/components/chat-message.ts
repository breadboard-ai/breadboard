/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ReactiveTurnState } from "../state/turn.js";
import { iconButtonStyle } from "../style/icon-button.js";
import "./markdown.js";
import "./tool-call.js";

@customElement("bbrt-chat-message")
export class BBRTChatMessage extends SignalWatcher(LitElement) {
  @property({ type: Object })
  accessor turn: ReactiveTurnState | undefined = undefined;

  @property({ type: Boolean })
  accessor hideIcon = false;

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
        --bb-icon: var(--bb-icon-fork-down-right);
        --bb-icon-size: 20px;
      }
      #actions button:not(:hover) {
        --bb-button-background: transparent;
      }
      :host(:last-of-type) #actions {
        opacity: 100%;
      }
    `,
  ];

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
          ${this.#renderFunctionCalls()}
        </div>
      `,
      this.#actions,
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
    const role = this.hideIcon ? undefined : this.turn.role;
    return html`<svg
      aria-label="${role}"
      role="img"
      part="icon icon-${role} icon-${this.turn.status}"
    >
      ${role ? svg`<use href="/bbrt/images/${role}.svg#icon"></use>` : nothing}
    </svg>`;
  }

  get #actions() {
    if (!this.turn) {
      return nothing;
    }
    return html`
      <div id="actions">
        <button
          id="forkButton"
          class="bb-icon-button"
          title="Fork"
          @click=${this.#onClickForkButton}
        ></button>
      </div>
    `;
  }

  #onClickForkButton() {
    if (!this.turn) {
      return;
    }
    console.log("fork!");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-chat-message": BBRTChatMessage;
  }
}
