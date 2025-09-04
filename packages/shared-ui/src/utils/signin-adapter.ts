/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Connection,
  ListConnectionsResponse,
  SignedOutTokenResult,
  TokenGrant,
  TokenVendor,
  ValidTokenResult,
} from "@breadboard-ai/connection-client";
import type { GrantResponse } from "@breadboard-ai/types/oauth.js";
import type { GlobalConfig } from "../contexts/global-config";
import {
  OAuthStateParameter,
  oauthTokenBroadcastChannelName,
} from "../elements/connection/connection-common";
import { SETTINGS_TYPE, SettingsHelper } from "../types/types";
import { createContext } from "@lit/context";
import { getEmbedderRedirectUri } from "./embed-helpers";
import { type OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";

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
    };

export const signinAdapterContext = createContext<SigninAdapter | undefined>(
  "SigninAdapter"
);

export type SignInError =
  | { code: "missing-scopes"; missingScopes: string[] }
  | { code: "geo-restriction" }
  | { code: "other"; detail: string };

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
  readonly #handleSignInRequest?: () => Promise<boolean>;
  #nonce = crypto.randomUUID();
  #state: SigninAdapterState;

  constructor(
    tokenVendor: TokenVendor,
    globalConfig: GlobalConfig,
    settingsHelper: SettingsHelper,
    handleSignInRequest?: () => Promise<boolean>
  ) {
    this.#tokenVendor = tokenVendor;
    this.#globalConfig = globalConfig;
    this.#settingsHelper = settingsHelper;
    this.#handleSignInRequest = handleSignInRequest;

    if (globalConfig.signinMode === "disabled") {
      this.#state = { status: "anonymous" };
      return;
    }

    const token = tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
    if (token.state === "signedout") {
      if (globalConfig.signinMode === "incremental") {
        // TODO(aomarks) Temporary weirdness.
        this.#state = { status: "anonymous" };
        return;
      }
      this.#state = { status: "signedout" };
      return;
    }

    const { grant } = token;
    this.#state = {
      status: "signedin",
      id: grant.id,
      name: grant.name,
      picture: grant.picture,
      domain: grant.domain,
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

  /**
   * Gets you a token, refreshing automatically if needed, unless the user is
   * signed out.
   */
  async token(
    scopes?: OAuthScope[]
  ): Promise<ValidTokenResult | SignedOutTokenResult> {
    if (this.#state.status === "anonymous") {
      await this.#handleSignInRequest?.();
      if (
        // Cast needed because TypeScript doesn't realize that the await above
        // could change the #state type.
        (this.#state as SigninAdapterState).status !== "signedin"
      ) {
        return { state: "signedout" };
      }
    }
    let token = this.#tokenVendor.getToken(SIGN_IN_CONNECTION_ID, scopes);
    if (token.state === "expired") {
      token = await token.refresh();
      if (token.state === "signedout") {
        if ((await this.signIn()).ok) {
          token = this.#tokenVendor.getToken(SIGN_IN_CONNECTION_ID, scopes);
        }
      }
    }
    switch (token.state) {
      case "valid":
      case "signedout":
        return token;

      default:
        token.state satisfies "expired";
        throw new Error("Invalid token state after refresh: " + token.state);
    }
  }

  #cachedConnection: Promise<Connection | undefined> | undefined;

  async #getConnection(): Promise<Connection | undefined> {
    return (this.#cachedConnection ??= (async () => {
      const url = new URL("list", this.#globalConfig.connectionServerUrl);
      const httpRes = await fetch(url, { credentials: "include" });
      if (!httpRes.ok) {
        return;
      } else {
        console.warn(
          `SigninAdapter: Failed to fetch connections from ${url.href}, status: ${httpRes.status} ${httpRes.statusText}`
        );
      }
      const list = (await httpRes.json()) as ListConnectionsResponse;
      const connection = list.connections.find(
        (connection) => connection.id == SIGN_IN_CONNECTION_ID
      );
      if (!connection) {
        return;
      }
      return connection;
    })());
  }

  async getSigninUrl(): Promise<string> {
    if (this.#state.status === "signedin") return "";

    const connection = await this.#getConnection();
    if (!connection) return "";

    let redirectUri = this.#globalConfig.connectionRedirectUrl;
    if (!redirectUri) return "";

    redirectUri = new URL(redirectUri, new URL(window.location.href).origin)
      .href;

    // If embedder has passed in a valid oauth redirect, use that instead.
    redirectUri = getEmbedderRedirectUri() ?? redirectUri;

    const authUrl = new URL(connection.authUrl);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set(
      "state",
      JSON.stringify({
        connectionId: SIGN_IN_CONNECTION_ID,
        nonce: this.#nonce,
      } satisfies OAuthStateParameter)
    );
    return authUrl.href;
  }

  async signIn(): Promise<{ ok: true } | { ok: false; error: SignInError }> {
    const now = Date.now();
    // The OAuth broker page will know to broadcast the token on this unique
    // channel because it also knows the nonce (since we pack that in the OAuth
    // "state" parameter).
    const channelName = oauthTokenBroadcastChannelName(this.#nonce);
    // Reset the nonce in case the user signs out and signs back in again, since
    // we don't want to ever mix up different requests.
    this.#nonce = crypto.randomUUID();
    const channel = new BroadcastChannel(channelName);
    const grantResponse = await new Promise<GrantResponse>((resolve) => {
      channel.addEventListener("message", (m) => resolve(m.data), {
        once: true,
      });
    });
    channel.close();
    if (grantResponse.error !== undefined) {
      console.error(grantResponse.error);
      if (grantResponse.error.includes("region")) {
        return {
          ok: false,
          error: { code: "geo-restriction" },
        };
      }
      return {
        ok: false,
        error: { code: "other", detail: grantResponse.error },
      };
    }

    if (await this.userHasGeoRestriction(grantResponse.access_token)) {
      return { ok: false, error: { code: "geo-restriction" } };
    }

    const connection = await this.#getConnection();
    if (!connection) {
      return {
        ok: false,
        error: { code: "other", detail: "Connection not found" },
      };
    }

    // Check for any missing required scopes.
    const requiredScopes = connection.scopes
      .filter(({ optional }) => !optional)
      .map(({ scope }) => scope);
    const actualScopes = new Set(grantResponse.scopes ?? []);
    const missingScopes = requiredScopes.filter(
      (scope) => !actualScopes.has(scope)
    );
    if (missingScopes.length > 0) {
      return {
        ok: false,
        error: { code: "missing-scopes", missingScopes },
      };
    }

    const settingsValue: TokenGrant = {
      client_id: connection.clientId,
      access_token: grantResponse.access_token,
      expires_in: grantResponse.expires_in,
      issue_time: now,
      name: grantResponse.name,
      picture: grantResponse.picture,
      id: grantResponse.id,
      domain: grantResponse.domain,
      scopes: grantResponse.scopes,
    };
    await this.#settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, connection.id, {
      name: connection.id,
      value: JSON.stringify(settingsValue),
    });
    this.#state = {
      status: "signedin",
      id: grantResponse.id,
      name: grantResponse.name,
      picture: grantResponse.picture,
      domain: grantResponse.domain,
    };
    return { ok: true };
  }

  async signOut(): Promise<void> {
    const connection = await this.#getConnection();
    if (!connection) {
      return;
    }
    await this.#settingsHelper.delete(SETTINGS_TYPE.CONNECTIONS, connection.id);
    this.#state = { status: "signedout" };
  }

  async userHasGeoRestriction(accessToken: string): Promise<boolean> {
    const response = await fetch(
      new URL(
        "/v1beta1/checkAppAccess",
        this.#globalConfig.BACKEND_API_ENDPOINT
      ),
      { headers: { Authorization: `Bearer ${accessToken}` } }
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
    const connection = await this.#getConnection();
    if (!connection) {
      return { ok: false, error: "No connection" };
    }

    const settingsValueStr = (
      await this.#settingsHelper.get(SETTINGS_TYPE.CONNECTIONS, connection.id)
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
      console.log(`[signin] Upgrading signin storage to include scopes`);
      await this.#settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, connection.id, {
        name: connection.id,
        value: JSON.stringify({
          ...settingsValue,
          scopes: tokenInfoScopes.value,
        } satisfies TokenGrant),
      });
    }

    const canonicalizedRequiredScopes = new Set(
      connection.scopes
        .filter(({ optional }) => !optional)
        .map(({ scope }) => canonicalizeOAuthScope(scope))
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

/**
 * Some scopes go by multiple names.
 */
function canonicalizeOAuthScope(scope: string): string {
  if (scope === "https://www.googleapis.com/auth/userinfo.profile") {
    return "profile";
  }
  if (scope === "https://www.googleapis.com/auth/userinfo.email") {
    return "email";
  }
  return scope;
}
