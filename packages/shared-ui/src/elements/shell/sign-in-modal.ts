/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { consume } from "@lit/context";
import { HTMLTemplateResult, LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../../strings/helper.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import {
  signinAdapterContext,
  type SignInError,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { devUrlParams } from "../../utils/urls.js";

function appName() {
  const Strings = StringsHelper.forSection("Global");
  const APP_NAME = Strings.from("APP_NAME");
  return APP_NAME;
}

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
        display: contents;
      }

      bb-modal {
        &::part(container) {
          max-width: 318px;
        }
      }

      section {
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

      #missing-scopes-animation {
        margin: var(--bb-grid-size-2) 0;
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
    const { status } = this.#state;
    if (status === "closed") {
      return nothing;
    }
    if (status === "open") {
      const { reason } = this.#state.request;
      if (reason === "sign-in") {
        return this.#renderSignInRequest();
      }
      if (reason === "add-scope") {
        return this.#renderAddScopeRequest();
      }
      reason satisfies never;
      return nothing;
    }
    if (status === "error") {
      const { code } = this.#state.error;
      if (code === "geo-restriction") {
        return this.#renderGeoRestriction();
      }
      if (code === "missing-scopes") {
        return this.#renderMissingScopes();
      }
      code satisfies "other";
      return this.#renderOtherError();
    }
    status satisfies never;
    return nothing;
  }

  #renderSignInRequest() {
    return this.#renderModal(
      `Sign in to use ${appName()}`,
      html`
        <p>To continue, you'll need to sign in with your Google account.</p>
        <aside>${this.#renderSignInButton()}</aside>
      `
    );
  }

  #renderAddScopeRequest() {
    // TODO(aomarks) Customize this based on the scope being requested.
    return this.#renderModal(
      "Additional access needed",
      html`
        <p>
          To continue, you'll need to grant additional access to your Google
          account.
        </p>
        <aside>${this.#renderAddScopeButton()}</aside>
      `
    );
  }

  #renderGeoRestriction() {
    return this.#renderModal(
      `${appName()} is not available in your country yet`,
      nothing
    );
  }

  #renderMissingScopes() {
    return this.#renderModal(
      "Additional access required",
      html`
        <p>
          Please click <em>Sign in</em> again, and choose
          <em>Select all</em> when you are asked about access.
        </p>
        <img
          id="missing-scopes-animation"
          src="/styles/landing/images/sign-in-scopes-screenshot.gif"
          width="320"
          height="285"
        />
        <aside>${this.#renderSignInButton()}</aside>
      `
    );
  }

  #renderOtherError() {
    return this.#renderModal(
      "Unexpected error",
      html`<p>An unexpected error occured.</p>`
    );
  }

  #renderModal(title: string, content: HTMLTemplateResult | typeof nothing) {
    return html`
      <bb-modal
        appearance="basic"
        blurBackground
        .modalTitle=${title}
        @bbmodaldismissed=${this.#onDismiss}
      >
        <section>${content}</section>
      </bb-modal>
    `;
  }

  #renderSignInButton() {
    return html`
      <button id="sign-in" class="sans" @click=${this.#onClickSignIn}>
        <img src="/styles/landing/images/g-logo.png" width="20" height="20" />
        Sign in with Google
      </button>
    `;
  }

  #renderAddScopeButton() {
    return html`
      <button id="sign-in" class="sans" @click=${this.#onClickSignIn}>
        <img src="/styles/landing/images/g-logo.png" width="20" height="20" />
        Grant access
      </button>
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
