/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SigninAdapter } from "../../utils/signin-adapter";
import { until } from "lit/directives/until.js";
import { SignInEvent } from "../../events/events";

@customElement("bb-connection-entry-signin")
export class ConnectionEntrySignin extends LitElement {
  static styles = css`
    @keyframes fadeAndZoomIn {
      from {
        opacity: 0;
        scale: 0.9 0.9;
      }

      to {
        opacity: 1;
        scale: 1 1;
      }
    }

    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100svw;
      height: 100svh;
      overflow: hidden;
      background: var(--bb-ui-50);
    }

    #container {
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--bb-grid-size-10);
      box-shadow: var(--bb-elevation-5);
      animation: fadeAndZoomIn 0.8s cubic-bezier(0, 0, 0.3, 1);

      & #logo {
        background: var(--bb-logo) center center / contain no-repeat;
        width: 80px;
        aspect-ratio: 1/1;
      }

      & h1 {
        margin: var(--bb-grid-size-5) 0;
        padding: 0;
        font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
          var(--bb-font-family);
        text-align: center;
        width: 100%;
        color: var(--bb-neutral-800);
      }

      & a {
        display: flex;
        align-items: center;
        background: var(--bb-ui-500) var(--bb-icon-login-inverted) 12px center /
          24px 24px no-repeat;
        color: var(--bb-neutral-0);
        border-radius: var(--bb-grid-size-16);
        padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-11);
        text-decoration: none;
        height: var(--bb-grid-size-10);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:hover,
        &:focus {
          background-color: var(--bb-ui-600);
        }
      }

      & p.error-message {
        margin: 0;
        padding-top: var(--bb-grid-size-6);
        max-width: 200px;
        color: red;
        text-align: center;
      }
    }
  `;

  @property()
  accessor adapter: SigninAdapter | null = null;

  @state()
  accessor errorMessage: string | null = null;

  render() {
    if (!this.adapter) {
      return nothing;
    }

    if (this.adapter.state !== "signedout") return nothing;

    return html` <div id="container">
      <div id="logo"></div>
      <h1>Welcome to ${Strings.from("APP_NAME")}</h1>
      <a
        .href=${until(this.adapter.getSigninUrl())}
        @click=${() => {
          if (!this.adapter) {
            return;
          }

          this.adapter.whenSignedIn(async (adapter) => {
            // The adapter is immutable, this callback will always return a new
            // copy with a new state, including picture and name.
            if (adapter.state === "valid") {
              this.dispatchEvent(new SignInEvent());
            } else if (adapter.errorMessage) {
              this.errorMessage = adapter.errorMessage;
            }
          });
        }}
        target="_blank"
        title="Sign into Google"
        >Sign into Google</a
      >
      ${this.errorMessage
        ? html`<p class="error-message">${this.errorMessage}</p>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-connection-entry-signin": ConnectionEntrySignin;
  }
}
