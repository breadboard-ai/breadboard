/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SnackbarMessage } from "../../types/types.js";
import { SnackbarUUID, SnackType } from "../../../sca/types.js";
import { repeat } from "lit/directives/repeat.js";
import { SnackbarActionEvent } from "../../events/events.js";
import * as Styles from "../../styles/styles.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const DEFAULT_TIMEOUT = 10000;

@customElement("bb-snackbar")
export class Snackbar extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ reflect: true, type: Boolean })
  accessor active = false;

  @property({ reflect: true, type: Boolean })
  accessor error = false;

  @property()
  accessor timeout = DEFAULT_TIMEOUT;

  #timeout = 0;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      :host {
        --text-color: var(--light-dark-n-100);

        display: flex;
        align-items: center;
        position: fixed;
        bottom: var(--bb-grid-size-7);
        left: 50%;
        translate: -50% 0;
        opacity: 0;
        pointer-events: none;
        border-radius: var(--bb-grid-size-2);
        background: var(--light-dark-n-10);
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
        background: var(--light-dark-e-98);
        --text-color: var(--light-dark-e-20);
      }

      .g-icon {
        flex: 0 0 auto;
        color: var(--text-color);
        margin-right: var(--bb-grid-size-4);

        &.rotate {
          animation: 1s linear 0s infinite normal forwards running rotate;
        }
      }

      #messages {
        color: var(--text-color);
        flex: 1 1 auto;
        max-height: 120px;
        overflow-y: auto;
        margin: 0;

        a,
        a:visited {
          color: var(--light-dark-p-40);
          text-decoration: none;
          &:hover {
            color: var(--light-dark-p-50);
            text-decoration: underline;
          }
        }
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

        .g-icon {
          margin-right: 0;
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  /**
   * Gets the messages from the SnackbarController signal.
   */
  get #messages(): SnackbarMessage[] {
    // Read from the signal - SignalWatcher will auto-update when it changes
    const snackbarMap = this.sca?.controller.global.snackbars.snackbars;
    if (!snackbarMap) {
      return [];
    }
    return Array.from(snackbarMap.values());
  }

  /**
   * Hides a snackbar by ID, delegating to the SnackbarController.
   */
  hide(id?: SnackbarUUID) {
    this.sca?.controller.global.snackbars.unsnackbar(id);
  }

  protected willUpdate(): void {
    const messages = this.#messages;

    // Update active/error state based on messages
    this.active = messages.length > 0;
    this.error = messages.some((msg) => msg.type === SnackType.ERROR);

    // Handle auto-dismiss timeout
    window.clearTimeout(this.#timeout);
    if (messages.length > 0 && !messages.every((msg) => msg.persistent)) {
      this.#timeout = window.setTimeout(() => {
        this.hide();
      }, this.timeout);
    }
  }

  render() {
    const messages = this.#messages;

    let rotate = false;
    let icon = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].type || messages[i].type === SnackType.NONE) {
        continue;
      }

      icon = messages[i].type;
      if (messages[i].type === SnackType.PENDING) {
        icon = "progress_activity";
        rotate = true;
      }
      break;
    }

    return html` ${icon
        ? html`<span
            class=${classMap({
              "g-icon": true,
              round: true,
              filled: true,
              heavy: true,
              rotate,
            })}
            >${icon}</span
          >`
        : nothing}
      <div id="messages">
        ${repeat(
          messages,
          (message) => message.id,
          (message) => {
            return html`<div>${message.message}</div>`;
          }
        )}
      </div>
      <div id="actions">
        ${repeat(
          messages,
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
                      new SnackbarActionEvent(
                        action.action,
                        action.value,
                        action.callback
                      )
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
          this.dispatchEvent(new SnackbarActionEvent("dismiss"));
        }}
      >
        <span class="g-icon filled heavy round">close</span>
      </button>`;
  }
}
