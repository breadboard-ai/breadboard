/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { clearIdbGraphCache } from "@breadboard-ai/google-drive-kit/board-server/user-graph-collection.js";
import type {
  CheckAppAccessResult,
  OpalShellProtocol,
  SignInResult,
  SignInState,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";

export const SIGN_IN_CONNECTION_ID = "$sign-in";

export const signinAdapterContext = createContext<SigninAdapter | undefined>(
  "SigninAdapter"
);

/**
 * A specialized adapter to handle sign in using the connection server
 * machinery.
 * Is intended as a lightweight instance that can be
 * used wherever the tokenVendor, environment, and
 * settingsHelper are present.
 */
export class SigninAdapter {
  readonly #opalShell: OpalShellProtocol;
  readonly #handleSignInRequest?: (scopes?: OAuthScope[]) => Promise<boolean>;
  #state: SignInState;
  readonly fetchWithCreds: typeof globalThis.fetch;

  constructor(
    opalShell: OpalShellProtocol,
    // TODO(aomarks) Hacky workaround for asynchrony, revisit the API for the
    // getters so that we don't need this.
    initialState: SignInState,
    handleSignInRequest?: () => Promise<boolean>
  ) {
    this.#opalShell = opalShell;
    this.#handleSignInRequest = handleSignInRequest;
    this.fetchWithCreds = opalShell.fetchWithCreds.bind(opalShell);
    this.#state = initialState;
  }

  get state() {
    return this.#state.status;
  }

  get name() {
    return this.#state.status === "signedin" ? this.#state.name : undefined;
  }

  get picture() {
    return this.#state.status === "signedin" ? this.#state.picture : undefined;
  }

  get domain() {
    return this.#state.status === "signedin" ? this.#state.domain : undefined;
  }

  get scopes(): Set<string> | undefined {
    return this.#state.status === "signedin"
      ? new Set(this.#state.scopes)
      : undefined;
  }

  async signIn(scopes: OAuthScope[] = []): Promise<SignInResult> {
    // Important! There must be no awaits before the window.open call, because
    // we need it to open syncronously so that the browser will allow it in
    // response to a click event.
    const signInUrlAndNoncePromise =
      this.#opalShell.generateSignInUrlAndNonce(scopes);
    const popupWidth = 900;
    const popupHeight = 850;
    // TODO(aomarks) We should also show a modal with a regular target="_blank"
    // link, in case the user's browser or an extension suppresses the popup.
    const popup = window.open(
      // First open a blank window because generating the actual sign-in URL is
      // asynchronous, and the window must be opened synchronously.
      "about:blank",
      "Sign in to Google",
      `
      width=${popupWidth}
      height=${popupHeight}
      left=${window.screenX + window.innerWidth / 2 - popupWidth / 2}
      top=${window.screenY + window.innerHeight / 2 - popupHeight / 2 + /* A little extra to account for the tabs, url bar etc.*/ 60}
      `
    );
    if (!popup) {
      return {
        ok: false,
        error: { code: "other", userMessage: "Popups are disabled" },
      };
    }
    const { url, nonce } = await signInUrlAndNoncePromise;
    const resultPromise = this.#opalShell
      .listenForSignIn(nonce)
      .catch((e): SignInResult => {
        console.error(`[signin] Unhandled error`, e);
        return {
          ok: false,
          error: { code: "other", userMessage: `Unhandled error` },
        };
      });
    popup.location.href = url;
    const result = await resultPromise;
    if (result.ok) {
      this.#state = result.state;
    }
    return result;
  }

  async signOut(): Promise<void> {
    await Promise.all([
      this.#opalShell.signOut(),
      // Clear caches on signout because they contain user-specific data, like
      // the user's graphs, which we must not share across different signins.
      clearIdbGraphCache(),
      (async () =>
        Promise.all(
          (await globalThis.caches.keys()).map((key) =>
            globalThis.caches.delete(key)
          )
        ))(),
    ]);
    this.#state = { status: "signedout" };
  }

  checkAppAccess(): Promise<CheckAppAccessResult> {
    return this.#opalShell.checkAppAccess();
  }

  validateScopes(): Promise<ValidateScopesResult> {
    return this.#opalShell.validateScopes();
  }
}
