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
} from "../../events/events";
import { icons } from "../../styles/icons.js";
import { SigninAdapter } from "../../utils/signin-adapter.js";

@customElement("bb-account-switcher")
export class AccountSwitcher extends LitElement {
  @property()
  accessor signInAdapter: SigninAdapter | null = null;

  @query("dialog")
  accessor #dialog: HTMLDialogElement | null = null;

  @query("#container")
  accessor #container: HTMLElement | null = null;

  static styles = [
    icons,
    css`
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
          background: var(--bb-neutral-0);
          border-radius: var(--bb-grid-size-4);
          border: 1px solid var(--bb-neutral-100);
          width: 100%;
          max-width: 300px;

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

          & #sign-out {
            width: 100%;
            max-width: 200px;
            font: 500 var(--bb-title-medium) / 1 var(--bb-font-family);
            margin-bottom: var(--bb-grid-size-3);
            height: var(--bb-grid-size-10);
            border-radius: var(--bb-grid-size-16);
            border: 1px solid var(--bb-neutral-300);
            background: var(--bb-neutral-100);
            margin-bottom: var(--bb-grid-size-6);
            transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:not([disabled]) {
              cursor: pointer;

              &:hover,
              &:focus {
                background: var(--bb-neutral-200);
              }
            }
          }

          a {
            display: block;
            font: 500 var(--bb-body-small) / 1 var(--bb-font-family);
            color: var(--bb-neutral-800);
            text-decoration: none;
            text-align: center;
          }
        }

        &::backdrop {
          background: transparent;
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
      ${ref((el?: Element) => {
        if (!el) {
          return;
        }

        const dialog = el as HTMLDialogElement;
        requestAnimationFrame(() => {
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
          <img
            src=${this.signInAdapter.picture}
            alt=${this.signInAdapter.name}
          />
          <div>
            <p>${this.signInAdapter.name}</p>
          </div>
        </section>
        <button
          id="sign-out"
          @click=${(evt: Event) => {
            evt.stopImmediatePropagation();

            this.dispatchEvent(new OverflowMenuActionEvent("logout"));
          }}
        >
          Sign out
        </button>
        <a href="/policy">Privacy & Terms</a>
      </section>
    </dialog>`;
  }
}
