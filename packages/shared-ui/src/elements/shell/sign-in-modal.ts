/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing, type HTMLTemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../../strings/helper.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";
import {
  signinAdapterContext,
  type SigninAdapter,
} from "../../utils/signin-adapter.js";
import { devUrlParams } from "../../utils/urls.js";

type State =
  | { status: "closed" }
  | {
      status:
        | "sign-in"
        | "add-scope"
        | "geo-restriction"
        | "missing-scopes"
        | "other-error";
      request: SignInRequest;
    };

type SignInRequest = {
  scopes: OAuthScope[] | undefined;
  outcomePromise: Promise<boolean>;
  outcomeResolve: (outcome: boolean) => void;
};

function appName() {
  const Strings = StringsHelper.forSection("Global");
  const APP_NAME = Strings.from("APP_NAME");
  return APP_NAME;
}

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
    css`
      :host {
        display: contents;
      }

      bb-modal::part(container) {
        max-width: 318px;
      }

      #container {
        display: flex;
        align-items: center;
        flex-direction: column;
      }

      p {
        font-size: 16px;
        margin: 0 0 var(--bb-grid-size-2) 0;
        text-align: center;
      }

      #sign-in-button,
      #add-scope-button {
        /* TODO(aomarks) Use the common button styles class */
        margin-top: var(--bb-grid-size-4);
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
      this.openAndWaitForSignIn([], "sign-in");
      if (this.#state.status !== "sign-in") {
        throw new Error(`Expected status to be "sign-in"`);
      }
      this.#state = {
        status: forceSignInState,
        request: this.#state.request,
      };
    }
  }

  render() {
    const { status } = this.#state;
    if (status === "closed") {
      return nothing;
    }
    if (status === "sign-in") {
      return this.#renderSignInRequest();
    }
    if (status === "add-scope") {
      return this.#renderAddScopeRequest();
    }
    if (status === "geo-restriction") {
      return this.#renderGeoRestriction();
    }
    if (status === "missing-scopes") {
      return this.#renderMissingScopes();
    }
    if (status === "other-error") {
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
        ${this.#renderSignInButton()}
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
        ${this.#renderAddScopeButton()}
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
        ${this.#renderSignInButton()}
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
        @bbmodaldismissed=${this.#close}
      >
        <section id="container">${content}</section>
      </bb-modal>
    `;
  }

  #renderSignInButton() {
    return html`
      <button id="sign-in-button" class="sans" @click=${this.#onClickSignIn}>
        <img src="/styles/landing/images/g-logo.png" width="20" height="20" />
        Sign in with Google
      </button>
    `;
  }

  #renderAddScopeButton() {
    return html`
      <button id="add-scope-button" class="sans" @click=${this.#onClickSignIn}>
        <img src="/styles/landing/images/g-logo.png" width="20" height="20" />
        Grant access
      </button>
    `;
  }

  async openAndWaitForSignIn(
    scopes?: OAuthScope[],
    status?: "sign-in" | "add-scope"
  ): Promise<boolean> {
    if (this.#state.status !== "closed") {
      return this.#state.request.outcomePromise;
    }
    let resolve: (outcome: boolean) => void;
    const outcomePromise = new Promise<boolean>((r) => (resolve = r));
    this.#state = {
      status:
        status ??
        (this.signinAdapter?.state === "signedin" ? "add-scope" : "sign-in"),
      request: {
        outcomePromise,
        outcomeResolve: resolve!,
        scopes,
      },
    };
    return outcomePromise;
  }

  async #onClickSignIn() {
    if (this.#state.status === "closed") {
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
    const { status, request } = this.#state;
    if (!outcome.ok) {
      const { code } = outcome.error;
      if (code === "missing-scopes" || code === "geo-restriction") {
        this.#state = { status: code, request };
      } else {
        this.#state = { status: "other-error", request };
      }
      return;
    }
    if (status === "sign-in") {
      // TODO(aomarks) Remove the reload after the app is fully reactive to a
      // sign-in. Known issues: Google Drive client auth strategy, top-right
      // user icon.
      window.location.reload();
    }
    this.#close(outcome.ok);
  }

  #close(outcome: boolean) {
    if (this.#state.status === "closed") {
      return;
    }
    this.#state.request.outcomeResolve(outcome);
    this.#state = { status: "closed" };
  }
}
