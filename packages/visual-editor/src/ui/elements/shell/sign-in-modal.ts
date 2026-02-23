/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { consume } from "@lit/context";
import { LitElement, css, html, nothing, type HTMLTemplateResult } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { type OAuthScope } from "../../connection/oauth-scopes.js";

import { markdown } from "../../directives/markdown.js";
import { ModalDismissedEvent, StateEvent } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { UserSignInResponse } from "../../../sca/types.js";
import { devUrlParams } from "../../navigation/urls.js";
import { scaContext } from "../../../sca/context/context.js";
import { SCA } from "../../../sca/sca.js";

type State =
  | { status: "closed" }
  | {
      status:
        | "sign-in"
        | "add-scope"
        | "geo-restriction"
        | "missing-scopes"
        | "consent-only"
        | "other-error";
      request: SignInRequest;
    };

type SignInRequest = {
  scopes: OAuthScope[] | undefined;
  outcomePromise: Promise<UserSignInResponse>;
  outcomeResolve: (outcome: UserSignInResponse) => void;
};

function appName() {
  const Strings = StringsHelper.forSection("Global");
  const APP_NAME = Strings.from("APP_NAME");
  return APP_NAME;
}

@customElement("bb-sign-in-modal")
export class VESignInModal extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  @property({ attribute: false })
  accessor sca!: SCA;

  @property()
  accessor consentMessage: string | undefined = undefined;

  @property()
  accessor blurBackground: boolean | null = null;

  @state()
  accessor #state: State = { status: "closed" };

  static styles = [
    type,
    baseColors,
    css`
      :host {
        display: contents;
      }

      #container {
        display: flex;
        align-items: center;
        flex-direction: column;
        max-width: 318px;

        &.large {
          width: calc(100vw - 90px);
          max-width: 500px;
          align-items: flex-end;

          #consent {
            height: calc(100vh - 210px);
            max-height: 450px;
            overflow-y: auto;
          }
        }
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
        background: var(--light-dark-n-0);
        border: none;
        border-radius: var(--bb-grid-size-16);
        color: var(--light-dark-n-100);
        padding: 16px 24px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        img {
          margin-right: 8px;
        }
        &:hover {
          background: var(--light-dark-n-25);
        }

        &[disabled] {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }

      #missing-scopes-animation {
        margin: var(--bb-grid-size-2) 0;
      }

      div#consent {
        p {
          text-align: revert;
          font-size: revert;
        }
      }

      div#buttons {
        display: flex;
        flex-direction: row;
        button {
          margin-left: 16px;
        }
      }

      #cancel-button {
        margin-top: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-16);
        background: none;
        border: none;
        padding: 16px 24px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        img {
          margin-right: 8px;
        }
        &:hover {
          background: var(--light-dark-n-98);
        }
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

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  render() {
    const { status } = this.#state;
    if (status === "closed") {
      return nothing;
    }
    if (status === "sign-in" || status === "consent-only") {
      return this.#renderSignIn();
    }
    if (status === "add-scope") {
      return this.#renderAddScope();
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

  #renderSignIn() {
    if (this.consentMessage) {
      return this.#renderModal(
        `Welcome to ${appName()}`,
        "large",
        html`<div id="consent">${markdown(this.consentMessage)}</div>
          ${this.#renderAcceptCancelButtons()} `
      );
    } else {
      return this.#renderModal(
        `Sign in to use ${appName()}`,
        "small",
        html`
          <p>To continue, you'll need to sign in with your Google account.</p>
          ${this.#renderSignInButton()}
        `
      );
    }
  }

  #renderAddScope() {
    // TODO(aomarks) Customize this based on the scope being requested.
    return this.#renderModal(
      "Additional access needed",
      "small",
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
      "small",
      nothing
    );
  }

  #renderMissingScopes() {
    return this.#renderModal(
      "Additional access required",
      "small",
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
      "small",
      html`<p>An unexpected error occured.</p>`
    );
  }

  #renderModal(
    title: string,
    type: "large" | "small",
    content: HTMLTemplateResult | typeof nothing
  ) {
    return html`
      <bb-modal
        appearance="basic"
        ?blurBackground=${this.blurBackground}
        .modalTitle=${title}
        @bbmodaldismissed=${() => this.#close("dismissed")}
      >
        <section id="container" class=${classMap({ large: type === "large" })}>
          ${content}
        </section>
      </bb-modal>
    `;
  }

  #renderAcceptCancelButtons() {
    return html`
      <div id="buttons">
        <button
          id="cancel-button"
          class="sans"
          @click=${() => {
            this.dispatchEvent(new ModalDismissedEvent());
            this.#close("dismissed");
          }}
        >
          Cancel
        </button>
        <button
          id="sign-in-button"
          class="sans accept"
          @click=${this.#onClickAccept}
        >
          Accept
        </button>
      </div>
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

  async openAndWaitForConsent(): Promise<UserSignInResponse> {
    let resolve: (outcome: UserSignInResponse) => void;
    const outcomePromise = new Promise<UserSignInResponse>(
      (r) => (resolve = r)
    );

    this.#state = {
      status: "consent-only",
      request: { outcomePromise, outcomeResolve: resolve!, scopes: [] },
    };
    const result = await outcomePromise;
    this.#state = { status: "closed" };
    return result;
  }

  async openAndWaitForSignIn(
    scopes?: OAuthScope[],
    status?: "sign-in" | "add-scope"
  ): Promise<UserSignInResponse> {
    if (this.#state.status !== "closed") {
      return (await this.#state.request.outcomePromise) ? "success" : "failure";
    }
    status ??=
      (await this.sca.services.signinAdapter.state) === "signedin"
        ? "add-scope"
        : "sign-in";
    let resolve: (outcome: UserSignInResponse) => void;
    const outcomePromise = new Promise<UserSignInResponse>(
      (r) => (resolve = r)
    );
    this.#state = {
      status,
      request: {
        outcomePromise,
        outcomeResolve: resolve!,
        scopes,
      },
    };
    const result = await outcomePromise;
    this.dispatchEvent(
      new StateEvent({ eventType: "host.usersignin", result })
    );
    return result;
  }

  async #onClickAccept() {
    if (this.#state.status !== "consent-only") {
      return this.#onClickSignIn();
    }
    this.sca?.services.actionTracker?.signInSuccess();
    this.#close("success");
  }

  async #onClickSignIn() {
    if (this.#state.status === "closed") {
      return;
    }
    if (!this.sca.services.signinAdapter) {
      console.warn(`sign-in-modal was not provided a signinAdapter`);
      this.#close("failure");
      return;
    }
    const result = await this.sca.services.signinAdapter.signIn(
      this.#state.request.scopes
    );
    const { status, request } = this.#state;
    if (!result.ok) {
      const { code } = result.error;
      if (code === "missing-scopes" || code === "geo-restriction") {
        this.#state = { status: code, request };
      } else if (code === "user-cancelled") {
        // The user denied sign-in e.g. by clicking "Cancel" during the OAuth
        // flow. Here we actually just do nothing. They can click "Sign-in"
        // again if they want, or they can close the modal with Escape etc.
      } else {
        this.#state = { status: "other-error", request };
      }
      return;
    } else {
      this.sca?.services.actionTracker?.signInSuccess();
    }
    if (status === "sign-in") {
      // TODO(aomarks) Remove the reload after the app is fully reactive to a
      // sign-in. Known issues: Google Drive client auth strategy, top-right
      // user icon.
      window.location.reload();
    }
    this.#close(result.ok ? "success" : "failure");
  }

  #close(outcome: UserSignInResponse) {
    if (this.#state.status === "closed") {
      return;
    }
    this.#state.request.outcomeResolve(outcome);
    this.#state = { status: "closed" };
  }
}
