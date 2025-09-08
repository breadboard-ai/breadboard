/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { devUrlParams } from "../../utils/urls.js";

@customElement("bb-sign-in-modal")
export class VESignInModal extends LitElement {
  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @state()
  accessor #state:
    | { status: "closed" }
    | {
        status: "open";
        reason: "sign-in" | "add-scope";
        scopes: OAuthScope[] | undefined;
        outcomePromise: Promise<boolean>;
        outcomeResolve: (outcome: boolean) => void;
      } = { status: "closed" };

  static styles = [
    type,
    colorsLight,
    icons,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      section {
        max-width: 500px;
      }

      p,
      li {
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      aside {
        display: flex;
        padding: var(--bb-grid-size-3) 0 var(--bb-grid-size-2) 0;
        justify-content: end;
      }

      #sign-in {
        display: flex;
        align-items: center;
        background: var(--n-0);
        border: none;
        border-radius: var(--bb-grid-size-16);
        margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-6);
        color: var(--n-100);
        height: var(--bb-grid-size-8);
        padding: 0 var(--bb-grid-size-4);
        font-size: 14px;
        transition: background 0.2s cubic-bezier(0, 0, 0.2, 1);
        cursor: pointer;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    const { forceSignInState } = devUrlParams();
    if (forceSignInState) {
      setTimeout(() => this.openAndWaitForSignIn([], forceSignInState), 100);
    }
  }

  render() {
    if (this.#state.status !== "open") {
      return nothing;
    }
    const { reason } = this.#state;
    return html`
      <bb-modal
        icon="login"
        .modalTitle=${reason === "sign-in"
          ? "Sign In"
          : "Requesting additional permissions"}
        showCloseButton
        @bbmodaldismissed=${this.#onDismiss}
      >
        <section>
          <p>
            ${reason === "sign-in"
              ? html`To continue, you'll need to sign in with your Google
                account.`
              : html`This action requires additional permissions. Please click
                  <em>Continue</em> to view permissions and allow access.`}
          </p>
          <aside>
            <button id="sign-in" class="sans" @click=${this.#onClickSignIn}>
              ${reason === "sign-in" ? "Sign In" : "Continue"}
            </button>
          </aside>
        </section>
      </bb-modal>
    `;
  }

  async openAndWaitForSignIn(
    scopes?: OAuthScope[],
    reason?: "sign-in" | "add-scope"
  ): Promise<boolean> {
    if (this.#state.status === "closed") {
      let resolve: (outcome: boolean) => void;
      this.#state = {
        status: "open",
        reason:
          reason ??
          (this.signinAdapter?.state === "signedin" ? "add-scope" : "sign-in"),
        outcomePromise: new Promise<boolean>((r) => (resolve = r)),
        outcomeResolve: resolve!,
        scopes,
      };
    }
    return this.#state.outcomePromise;
  }

  async #onClickSignIn() {
    if (this.#state.status !== "open") {
      return;
    }
    if (!this.signinAdapter) {
      console.warn(`sign-in-modal was not provided a signinAdapter`);
      this.#close(false);
      return;
    }
    const url = await this.signinAdapter.getSigninUrl(this.#state.scopes);
    const signInPromise = this.signinAdapter.signIn(this.#state.scopes);
    const popupWidth = 900;
    const popupHeight = 850;
    window.open(
      url,
      "Sign in to Google",
      `
      width=${popupWidth}
      height=${popupHeight}
      left=${window.screenX + window.innerWidth / 2 - popupWidth / 2}
      top=${window.screenY + window.innerHeight / 2 - popupHeight / 2}
      `
    );
    const outcome = await signInPromise;
    if (outcome.ok && this.#state.reason === "sign-in") {
      // TODO(aomarks) Remove the reload after the app is fully reactive to a
      // sign-in. Known issues: Google Drive client auth strategy, top-right
      // user icon.
      window.location.reload();
    }
    this.#close(outcome.ok);
  }

  #onDismiss() {
    if (this.#state.status !== "open") {
      return;
    }
    this.#close(false);
  }

  #close(outcome: boolean) {
    if (this.#state.status !== "open") {
      return;
    }
    this.#state.outcomeResolve(outcome);
    this.#state = { status: "closed" };
  }
}
