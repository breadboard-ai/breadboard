/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SignedOutTokenResult,
  TokenGrant,
  TokenVendor,
  ValidTokenResult,
} from "@breadboard-ai/connection-client";
import type { GlobalConfig } from "../contexts/global-config";
import { SETTINGS_TYPE, SettingsHelper } from "../types/types";
import { createContext } from "@lit/context";
import {
  ALWAYS_REQUIRED_OAUTH_SCOPES,
  canonicalizeOAuthScope,
  type OAuthScope,
} from "@breadboard-ai/connection-client/oauth-scopes.js";
import { clearIdbGraphCache } from "@breadboard-ai/google-drive-kit/board-server/user-graph-collection.js";
import { createFetchWithCreds } from "@breadboard-ai/utils";
import { scopesFromUrl } from "./scopes-from-url";
import type {
  OpalShellProtocol,
  SignInResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";

export { SigninAdapter };

export const SIGN_IN_CONNECTION_ID = "$sign-in";

export type SigninAdapterState =
  /** The runtime is not configured to use the sign in. */
  | { status: "anonymous" }
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
class SigninAdapter {
  readonly #tokenVendor: TokenVendor;
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
    this.#tokenVendor = tokenVendor;
    this.#globalConfig = globalConfig;
    this.#settingsHelper = settingsHelper;
    this.#opalShell = opalShell;
    this.#handleSignInRequest = handleSignInRequest;

    this.fetchWithCreds = createFetchWithCreds(async (url) => {
      const scopes = scopesFromUrl(url, globalConfig.BACKEND_API_ENDPOINT);
      if (!scopes) {
        throw new Error(`Unknown URL: ${url}. Unable to fetch.`);
      }
      let token: string | undefined;
      const tokenResult = await this.token(scopes);
      if (tokenResult.state === "valid") {
        token = tokenResult.grant.access_token;
      }
      if (!token) {
        throw new Error(`Unable to obtain access token for URL ${url}`);
      }
      return token;
    });

    if (globalConfig.signinMode === "disabled") {
      this.#state = { status: "anonymous" };
      return;
    }

    const token = tokenVendor.getToken();
    if (token.state === "signedout") {
      if (globalConfig.signinMode === "incremental") {
        // TODO(aomarks) Temporary weirdness.
        this.#state = { status: "anonymous" };
        return;
      }
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

  get id() {
    return this.#state.status === "signedin" ? this.#state.id : undefined;
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
    if (this.#state.status === "anonymous") {
      await this.#handleSignInRequest?.(scopes);
      if (
        // Cast needed because TypeScript doesn't realize that the await above
        // could change the #state type.
        (this.#state as SigninAdapterState).status !== "signedin"
      ) {
        return { state: "signedout" };
      }
    }
    let token = this.#tokenVendor.getToken();
    if (token.state === "expired") {
      token = await token.refresh();
    }
    switch (token.state) {
      case "valid": {
        if (scopes?.length) {
          const actualScopes = new Set(
            (token.grant.scopes ?? []).map((scope) =>
              canonicalizeOAuthScope(scope)
            )
          );
          const missingScopes = scopes.filter(
            (scope) => !actualScopes.has(scope)
          );
          if (missingScopes.length) {
            if (!this.#handleSignInRequest) {
              // TODO(aomarks) Add a new "insufficient-scopes" state.
              return { state: "signedout" };
            } else {
              await this.#handleSignInRequest(missingScopes);
              return this.token(scopes);
            }
          }
        }
        return token;
      }
      case "signedout": {
        return token;
      }

      default: {
        token.state satisfies "expired";
        throw new Error("Invalid token state after refresh: " + token.state);
      }
    }
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
      this.#settingsHelper.delete(
        SETTINGS_TYPE.CONNECTIONS,
        SIGN_IN_CONNECTION_ID
      ),
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

  // TODO(aomarks) Move to shell.
  async userHasGeoRestriction(token: string): Promise<boolean> {
    const response = await fetch(
      new URL(
        "/v1beta1/checkAppAccess",
        this.#globalConfig.BACKEND_API_ENDPOINT
      ),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} error checking geo restriction`);
    }
    const result = (await response.json()) as { canAccess?: boolean };
    return !result.canAccess;
  }

  async validateScopes(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.state !== "signedin") {
      return { ok: false, error: "User was signed out" };
    }

    const settingsValueStr = (
      await this.#settingsHelper.get(
        SETTINGS_TYPE.CONNECTIONS,
        SIGN_IN_CONNECTION_ID
      )
    )?.value as string | undefined;
    if (!settingsValueStr) {
      return { ok: false, error: "No local connection storage" };
    }
    const settingsValue = JSON.parse(settingsValueStr) as TokenGrant;

    const canonicalizedUserScopes = new Set<string>();
    if (settingsValue.scopes) {
      for (const scope of settingsValue.scopes) {
        canonicalizedUserScopes.add(canonicalizeOAuthScope(scope));
      }
    } else {
      // This is an older signin which doesn't have scopes stored locally. We
      // can fetch them from an API and upgrade the storage for next time.
      const tokenInfoScopes = await this.#fetchScopesFromTokenInfoApi();
      if (!tokenInfoScopes.ok) {
        console.error(
          `[signin] Unable to fetch scopes from token info API:` +
            ` ${tokenInfoScopes.error}`
        );
        return tokenInfoScopes;
      }
      for (const scope of tokenInfoScopes.value) {
        canonicalizedUserScopes.add(canonicalizeOAuthScope(scope));
      }
      console.info(`[signin] Upgrading signin storage to include scopes`);
      await this.#settingsHelper.set(
        SETTINGS_TYPE.CONNECTIONS,
        SIGN_IN_CONNECTION_ID,
        {
          name: SIGN_IN_CONNECTION_ID,
          value: JSON.stringify({
            ...settingsValue,
            scopes: tokenInfoScopes.value,
          } satisfies TokenGrant),
        }
      );
    }

    const canonicalizedRequiredScopes = new Set(
      ALWAYS_REQUIRED_OAUTH_SCOPES.map((scope) => canonicalizeOAuthScope(scope))
    );
    const missingScopes = [...canonicalizedRequiredScopes].filter(
      (scope) => !canonicalizedUserScopes.has(scope)
    );
    if (missingScopes.length > 0) {
      return {
        ok: false,
        error: `Missing scopes: ${missingScopes.join(", ")}`,
      };
    } else {
      return { ok: true };
    }
  }

  /** See https://cloud.google.com/docs/authentication/token-types#access */
  async #fetchScopesFromTokenInfoApi(): Promise<
    { ok: true; value: string[] } | { ok: false; error: string }
  > {
    const url = new URL("https://oauth2.googleapis.com/tokeninfo");
    // Make sure we have a fresh token, this API will return HTTP 400 for an
    // expired token.
    const token = await this.token();
    if (token.state === "signedout") {
      return { ok: false, error: "User was signed out" };
    }
    url.searchParams.set("access_token", token.grant.access_token);

    let response;
    try {
      response = await fetch(url);
    } catch (e) {
      return { ok: false, error: `Network error: ${e}` };
    }
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status} error` };
    }

    let result: { scope: string };
    try {
      result = await response.json();
    } catch (e) {
      return { ok: false, error: `JSON parse error: ${e}` };
    }

    return { ok: true, value: result.scope.split(" ") };
  }
}
