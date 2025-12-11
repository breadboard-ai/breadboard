/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, nothing } from "lit";

import { customElement, property, query } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import {
  OverflowMenuActionEvent,
  OverlayDismissedEvent,
  SubscriberCreditRefreshEvent,
} from "../../events/events.js";
import { icons } from "../../styles/icons.js";
import { SigninAdapter } from "../../utils/signin-adapter.js";

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { uiStateContext } from "../../contexts/ui-state.js";
import { UI } from "../../state/types.js";
import { type } from "../../styles/host/type.js";
import { until } from "lit/directives/until.js";

@customElement("bb-account-switcher")
export class AccountSwitcher extends SignalWatcher(LitElement) {
  @property()
  accessor signInAdapter: SigninAdapter | null = null;

  @consume({ context: uiStateContext })
  accessor uiState!: UI;

  @query("dialog")
  accessor #dialog: HTMLDialogElement | null = null;

  @query("#container")
  accessor #container: HTMLElement | null = null;

  static styles = [
    icons,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
      }

      dialog {
        padding: 0;
        margin: 0;
        border: none;
        position: relative;

        & #close {
          position: absolute;
          top: var(--bb-grid-size-3);
          right: var(--bb-grid-size-3);
          padding: 0;
          margin: 0;
          border-radius: 50%;
          border: none;
          background: transparent;
          width: 20px;
          height: 20px;

          &:not([disabled]) {
            cursor: pointer;
          }
        }

        & #container {
          display: flex;
          flex-direction: column;
          align-items: center;

          position: fixed;
          top: var(--bb-grid-size-13);
          right: var(--bb-grid-size-3);
          padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
          background: light-dark(var(--n-100), var(--n-20));
          border-radius: var(--bb-grid-size-4);
          border: 1px solid light-dark(var(--n-98), var(--n-20));
          box-shadow:
            0px 4px 8px 3px rgba(0, 0, 0, 0.15),
            0px 1px 3px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 360px;

          h1 {
            margin: 0 0 var(--bb-grid-size-5) 0;
            font: 500 var(--bb-title-large) / 1 var(--bb-font-family);
            text-align: center;
          }

          #user-info {
            display: grid;
            grid-template-columns: var(--bb-grid-size-7) min-content;
            column-gap: var(--bb-grid-size-3);
            margin-bottom: var(--bb-grid-size-3);
            white-space: nowrap;
            align-items: center;
            justify-content: center;
            min-width: 200px;

            & img {
              width: 100%;
              border-radius: 50%;
              aspect-ratio: 1 / 1;
            }

            & p {
              margin: 0;
            }
          }

          & #g1-container {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--bb-grid-size-3);
            padding: var(--bb-grid-size-2) var(--bb-grid-size-2)
              var(--bb-grid-size-2) var(--bb-grid-size-4);
            border-radius: var(--bb-grid-size-5);
            background: light-dark(var(--n-98), var(--n-10));

            & #credit-count {
              display: flex;
              align-items: center;

              & .g-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                margin-right: var(--bb-grid-size-2);
                position: relative;

                &.rotate {
                  animation: rotate 1s linear infinite;
                }

                &.circle {
                  &::after {
                    content: "";
                    border-radius: 50%;
                    position: absolute;
                    width: calc(100% - 4px);
                    height: calc(100% - 4px);
                    border: 2px solid var(--light-dark-n-0);
                    top: 0;
                    left: 0;
                  }
                }
              }
            }

            & #get-ai-credits {
              background: light-dark(var(--n-95), var(--n-30));
              border: none;
              border-radius: var(--bb-grid-size-3);
              padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
              cursor: pointer;
              transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  background: light-dark(var(--n-90), var(--n-40));
                }
              }
            }
          }

          & #manage-membership,
          & #sign-out {
            width: 100%;
            margin-bottom: var(--bb-grid-size-3);
            height: var(--bb-grid-size-10);
            border-radius: var(--bb-grid-size-16);
            border: 1px solid light-dark(var(--n-90), var(--n-20));
            background: light-dark(var(--n-100), var(--n-30));
            margin-bottom: var(--bb-grid-size-6);
            transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:not([disabled]) {
              cursor: pointer;

              &:hover,
              &:focus {
                background: light-dark(var(--n-95), var(--n-40));
              }
            }
          }

          & #manage-membership {
            margin-bottom: var(--bb-grid-size);
          }

          a {
            display: block;
            font: 500 var(--bb-body-small) / 1 var(--bb-font-family);
            color: var(--light-dark-n-20);
            text-decoration: none;
            text-align: center;
          }
        }

        &::backdrop {
          background: transparent;
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

  #close() {
    if (!this.#dialog) {
      return;
    }

    this.#dialog.close();
    this.dispatchEvent(new OverlayDismissedEvent());
  }

  #renderCreditCount() {
    const innerRender = () => {
      if (this.uiState.subscriptionCredits === -2) {
        return html` <span class="g-icon filled-heavy round">error</span>Failed
          to retrieve`;
      }

      if (this.uiState.subscriptionCredits === -1) {
        return html` <span class="g-icon rotate filled-heavy round"
            >progress_activity</span
          >Updating...`;
      }

      return html`<span class="g-icon circle filled-heavy round">spark</span
        >${this.uiState.subscriptionCredits} AI
        Credit${this.uiState.subscriptionCredits !== 1 ? "s" : ""}`;
    };

    return html`<span id="credit-count"> ${innerRender()} </span>`;
  }

  render() {
    if (!this.signInAdapter) {
      return nothing;
    }

    return html`<dialog
      @click=${(evt: Event) => {
        const els = evt.composedPath();
        if (els.some((el) => el === this.#container)) {
          return;
        }

        this.#close();
      }}
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }

        evt.preventDefault();
        this.#close();
      }}
      ${ref((el?: Element) => {
        if (!el) {
          return;
        }

        const dialog = el as HTMLDialogElement;
        requestAnimationFrame(() => {
          if (dialog.open) {
            return;
          }

          if (
            this.uiState.flags?.googleOne &&
            (this.uiState.subscriptionStatus === "error" ||
              this.uiState.subscriptionStatus === "subscribed")
          ) {
            this.dispatchEvent(new SubscriberCreditRefreshEvent());
          }
          dialog.showModal();
        });
      })}
    >
      <section id="container">
        <button
          id="close"
          @click=${() => {
            this.#close();
          }}
        >
          <span class="g-icon">close</span>
        </button>
        <h1>
          ${Strings.from("PROVIDER_NAME") !== ""
            ? Strings.from("PROVIDER_NAME")
            : Strings.from("APP_NAME")}
        </h1>
        <section id="user-info">
          ${until(
            (async () =>
              (await this.signInAdapter?.picture)
                ? html`<img
                    src=${await this.signInAdapter?.picture}
                    alt=${await this.signInAdapter?.name}
                  />`
                : nothing)()
          )}
          <div>
            <p>${until(this.signInAdapter.name.then((name) => name))}</p>
          </div>
        </section>
        ${this.uiState.flags?.googleOne &&
        (this.uiState.subscriptionStatus === "subscribed" ||
          this.uiState.subscriptionStatus === "error")
          ? html` <section
                id="g1-container"
                class="w-500 sans-flex md-body-medium"
              >
                ${this.#renderCreditCount()}
                <button
                  id="get-ai-credits"
                  class="sans-flex w-500 md-body-medium"
                  @click=${(evt: Event) => {
                    evt.stopImmediatePropagation();

                    this.dispatchEvent(
                      new OverflowMenuActionEvent("get-ai-credits")
                    );
                  }}
                >
                  Upgrade
                </button>
              </section>
              <button
                id="manage-membership"
                class="sans-flex w-500 md-body-medium"
                @click=${(evt: Event) => {
                  evt.stopImmediatePropagation();

                  this.dispatchEvent(
                    new OverflowMenuActionEvent("manage-membership")
                  );
                }}
              >
                Manage membership
              </button>`
          : nothing}
        <button
          id="sign-out"
          class="sans-flex w-500 md-body-medium"
          @click=${(evt: Event) => {
            evt.stopImmediatePropagation();

            this.dispatchEvent(new OverflowMenuActionEvent("logout"));
          }}
        >
          Sign out
        </button>
        <a href="https://policies.google.com/" target="_blank"
          >Privacy & Terms</a
        >
      </section>
    </dialog>`;
  }
}
