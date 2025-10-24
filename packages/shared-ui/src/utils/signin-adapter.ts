/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import {
  ALWAYS_REQUIRED_OAUTH_SCOPES,
  canonicalizeOAuthScope,
  type OAuthScope,
} from "@breadboard-ai/connection-client/oauth-scopes.js";
import { clearIdbGraphCache } from "@breadboard-ai/google-drive-kit/board-server/user-graph-collection.js";
import type {
  SignedOutTokenResult,
  TokenGrant,
  ValidTokenResult,
} from "@breadboard-ai/types/oauth.js";
import type {
  CheckAppAccessResult,
  OpalShellProtocol,
  SignInResult,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";
import type { GlobalConfig } from "../contexts/global-config";
import { SETTINGS_TYPE, SettingsHelper } from "../types/types";

export const SIGN_IN_CONNECTION_ID = "$sign-in";

export type SigninAdapterState =
  | { status: "signedout" }
  | {
      status: "signedin";
      id: string | undefined;
      domain: string | undefined;
      name: string | undefined;
      picture: string | undefined;
      scopes: Set<string>;
    };

export const signinAdapterContext = createContext<SigninAdapter | undefined>(
  "SigninAdapter"
);

/** @return Whether the user opened `signInUrl`. */
export type SignInRequestHandler = (signInUrl: string) => boolean;

/**
 * A specialized adapter to handle sign in using the connection server
 * machinery.
 * Is intended as a lightweight instance that can be
 * used wherever the tokenVendor, environment, and
 * settingsHelper are present.
 */
export class SigninAdapter {
  readonly #globalConfig: GlobalConfig;
  readonly #settingsHelper: SettingsHelper;
  readonly #opalShell: OpalShellProtocol;
  readonly #handleSignInRequest?: (scopes?: OAuthScope[]) => Promise<boolean>;
  #state: SigninAdapterState;
  readonly fetchWithCreds: typeof globalThis.fetch;

  constructor(
    tokenVendor: TokenVendor,
    globalConfig: GlobalConfig,
    settingsHelper: SettingsHelper,
    opalShell: OpalShellProtocol,
    handleSignInRequest?: () => Promise<boolean>
  ) {
    this.#globalConfig = globalConfig;
    this.#settingsHelper = settingsHelper;
    this.#opalShell = opalShell;
    this.#handleSignInRequest = handleSignInRequest;

    this.fetchWithCreds = opalShell.fetchWithCreds.bind(opalShell);

    const token = tokenVendor.getToken();
    if (token.state === "signedout") {
      this.#state = { status: "signedout" };
      return;
    }

    this.#state = this.#makeSignedInState(token.grant);
  }

  #makeSignedInState(grant: TokenGrant): SigninAdapterState {
    return {
      status: "signedin",
      id: grant.id,
      name: grant.name,
      picture: grant.picture,
      domain: grant.domain,
      scopes: new Set(
        (grant.scopes ?? []).map((scope) => canonicalizeOAuthScope(scope))
      ),
    };
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
    return this.#state.status === "signedin" ? this.#state.scopes : undefined;
  }

  /**
   * Gets you a token, refreshing automatically if needed, unless the user is
   * signed out.
   */
  async token(
    scopes?: OAuthScope[]
  ): Promise<ValidTokenResult | SignedOutTokenResult> {
    let token = await this.#opalShell.getToken(scopes);
    if (
      (token.state === "signedout" || token.state === "missing-scopes") &&
      this.#handleSignInRequest
    ) {
      if (await this.#handleSignInRequest(scopes)) {
        token = await this.#opalShell.getToken(scopes);
      }
    }
    if (token.state === "missing-scopes") {
      return { state: "signedout" };
    }
    return token;
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
    return await resultPromise;
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
