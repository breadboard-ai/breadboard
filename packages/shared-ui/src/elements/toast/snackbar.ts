/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SnackbarMessage, SnackType } from "../../types/types";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../../styles/icons";
import { SnackbarActionEvent } from "../../events/events";

const DEFAULT_TIMEOUT = 8000;

@customElement("bb-snackbar")
export class Snackbar extends LitElement {
  @property({ reflect: true, type: Boolean })
  accessor active = false;

  @property({ reflect: true, type: Boolean })
  accessor error = false;

  @property()
  accessor timeout = DEFAULT_TIMEOUT;

  #messages: SnackbarMessage[] = [];
  #timeout = 0;

  static styles = [
    icons,
    css`
      :host {
        --text-color: var(--bb-neutral-0);

        display: flex;
        align-items: center;
        position: fixed;
        bottom: var(--bb-grid-size-7);
        left: 50%;
        translate: -50% 0;
        opacity: 0;
        pointer-events: none;
        border-radius: var(--bb-grid-size-2);
        background: var(--bb-neutral-900);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-6);
        width: 60svw;
        max-width: 720px;
        z-index: 1800;
        scrollbar-width: none;
        overflow-x: scroll;
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
      }

      :host([active]) {
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1) 0.2s;
        opacity: 1;
        pointer-events: auto;
      }

      :host([error]) {
        background: var(--bb-snackbar-error);
        --text-color: var(--bb-snackbar-error-text);
      }

      > .g-icon {
        flex: 0 0 auto;
        color: var(--text-color);
        margin-right: var(--bb-grid-size-4);
      }

      #messages {
        color: var(--text-color);
        flex: 1 1 auto;
        margin-right: var(--bb-grid-size-11);
      }

      #actions {
        flex: 0 1 auto;
        width: fit-content;
        margin-right: var(--bb-grid-size-3);

        & button {
          font: 500 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          padding: 0;
          background: transparent;
          border: none;
          margin: 0 var(--bb-grid-size-4);
          color: var(--text-color);
          opacity: 0.7;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              opacity: 1;
            }
          }
        }
      }

      #close {
        display: flex;
        align-items: center;
        padding: 0;
        color: var(--text-color);
        background: transparent;
        border: none;
        margin: 0 0 0 var(--bb-grid-size-2);
        opacity: 0.7;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }
    `,
  ];

  show(message: SnackbarMessage) {
    const existingMessage = this.#messages.findIndex(
      (msg) => msg.id === message.id
    );
    if (existingMessage === -1) {
      this.#messages.push(message);
    } else {
      this.#messages[existingMessage] = message;
    }

    window.clearTimeout(this.#timeout);
    if (!this.#messages.every((msg) => msg.persistent)) {
      this.#timeout = window.setTimeout(() => {
        this.hide();
      }, this.timeout);
    }

    this.error = this.#messages.some((msg) => msg.type === SnackType.ERROR);
    this.active = true;
    this.requestUpdate();

    return message.id;
  }

  hide() {
    this.active = false;
    this.#messages.length = 0;
  }

  render() {
    let icon = "";
    for (let i = this.#messages.length - 1; i >= 0; i--) {
      if (
        !this.#messages[i].type ||
        this.#messages[i].type === SnackType.NONE
      ) {
        continue;
      }

      icon = this.#messages[i].type;
      break;
    }

    return html` ${icon ? html`<span class="g-icon">${icon}</span>` : nothing}
      <div id="messages">
        ${repeat(
          this.#messages,
          (message) => message.id,
          (message) => {
            return html`<div>${message.message}</div>`;
          }
        )}
      </div>
      <div id="actions">
        ${repeat(
          this.#messages,
          (message) => message.id,
          (message) => {
            if (!message.actions) {
              return nothing;
            }

            return html`${repeat(
              message.actions,
              (action) => action.value,
              (action) => {
                return html`<button
                  @click=${() => {
                    this.hide();
                    this.dispatchEvent(
                      new SnackbarActionEvent(action.action, action.value)
                    );
                  }}
                >
                  ${action.title}
                </button>`;
              }
            )}`;
          }
        )}
      </div>
      <button
        id="close"
        @click=${() => {
          this.hide();
        }}
      >
        <span class="g-icon">close</span>
      </button>`;
  }
}
