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
  signinAdapterContext,
  type SignInError,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { devUrlParams } from "../../utils/urls.js";

type Request = {
  reason: "sign-in" | "add-scope";
  scopes: OAuthScope[] | undefined;
  outcomePromise: Promise<boolean>;
  outcomeResolve: (outcome: boolean) => void;
};

type State =
  | { status: "closed" }
  | {
      status: "open";
      request: Request;
    }
  | {
      status: "error";
      request: Request;
      error: SignInError;
    };

@customElement("bb-sign-in-modal")
export class VESignInModal extends LitElement {
  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @state()
  accessor #state: State = { status: "closed" };

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
        max-width: 317px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        text-align: center;
      }

      p {
        font-size: 16px;
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      aside {
        display: flex;
        margin-top: var(--bb-grid-size-4);
        justify-content: end;
      }

      #sign-in {
        background: var(--n-0);
        border: none;
        border-radius: var(--bb-grid-size-16);
        color: var(--n-100);
        padding: 16px 24px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        img {
          margin-right: 8px;
        }
        &:hover {
          background: var(--n-25);
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    const { forceSignInState } = devUrlParams();
    if (forceSignInState) {
      if (forceSignInState === "sign-in" || forceSignInState === "add-scope") {
        this.openAndWaitForSignIn([], forceSignInState);
      } else {
        this.openAndWaitForSignIn([], "sign-in");
        if (this.#state.status === "open") {
          if (forceSignInState === "geo-restriction") {
            this.#state = {
              status: "error",
              request: this.#state.request,
              error: { code: forceSignInState },
            };
          } else if (forceSignInState === "missing-scopes") {
            this.#state = {
              status: "error",
              request: this.#state.request,
              error: { code: forceSignInState, missingScopes: [] },
            };
          }
        }
      }
    }
  }

  render() {
    if (this.#state.status === "closed") {
      return nothing;
    }
    const { reason } = this.#state.request;
    return html`
      <bb-modal
        appearance="basic"
        blurBackground
        .modalTitle=${reason === "sign-in"
          ? "Sign in to use Opal"
          : "Requesting additional permissions"}
        @bbmodaldismissed=${this.#onDismiss}
      >
        <section>
          <p>${this.#renderMessage()}</p>
          <aside>
            <button id="sign-in" class="sans" @click=${this.#onClickSignIn}>
              ${reason === "sign-in"
                ? html`
                    <img
                      src="/styles/landing/images/g-logo.png"
                      width="20"
                      height="20"
                    />
                    Sign in with Google
                  `
                : "Continue"}
            </button>
          </aside>
        </section>
      </bb-modal>
    `;
  }

  #renderMessage() {
    const state = this.#state;

    if (state.status === "closed") {
      return nothing;
    }

    if (state.status === "open") {
      const { reason } = state.request;
      return reason === "sign-in"
        ? html`To continue, you'll need to sign in with your Google account.`
        : html`This action requires additional permissions. Please click
            <em>Continue</em> to view permissions and allow access.`;
    }

    if (state.status === "error") {
      const { code } = state.error;
      if (code === "geo-restriction") {
        // TODO(aomarks) Polish this UX
        return html`Geo restrict`;
      }
      if (code === "missing-scopes") {
        // TODO(aomarks) Polish this UX
        return html`Missing scope`;
      }
      if (code === "other") {
        // TODO(aomarks) Polish this UX
        return html`Unknown error`;
      }
      code satisfies never;
      return nothing;
    }

    state satisfies never;
    return nothing;
  }

  async openAndWaitForSignIn(
    scopes?: OAuthScope[],
    reason?: "sign-in" | "add-scope"
  ): Promise<boolean> {
    if (this.#state.status === "closed") {
      let resolve: (outcome: boolean) => void;
      this.#state = {
        status: "open",
        request: {
          reason:
            reason ??
            (this.signinAdapter?.state === "signedin"
              ? "add-scope"
              : "sign-in"),
          outcomePromise: new Promise<boolean>((r) => (resolve = r)),
          outcomeResolve: resolve!,
          scopes,
        },
      };
    }
    return this.#state.request.outcomePromise;
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
    const url = await this.signinAdapter.getSigninUrl(
      this.#state.request.scopes
    );
    const signInPromise = this.signinAdapter.signIn(this.#state.request.scopes);
    const popupWidth = 900;
    const popupHeight = 850;
    window.open(
      url,
      "Sign in to Google",
      `
      width=${popupWidth}
      height=${popupHeight}
      left=${window.screenX + window.innerWidth / 2 - popupWidth / 2}
      top=${window.screenY + window.innerHeight / 2 - popupHeight / 2 + /* A little extra to account for the tabs, url bar etc.*/ 60}
      `
    );
    const outcome = await signInPromise;
    const request = this.#state.request;
    if (!outcome.ok) {
      this.#state = {
        status: "error",
        error: outcome.error,
        request,
      };
      return;
    }
    if (request.reason === "sign-in") {
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
    this.#state.request.outcomeResolve(outcome);
    this.#state = { status: "closed" };
  }
}
