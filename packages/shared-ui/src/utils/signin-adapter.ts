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
  #nonce = crypto.randomUUID();
  #state: SigninAdapterState;

  constructor(
    tokenVendor: TokenVendor,
    globalConfig: GlobalConfig,
    settingsHelper: SettingsHelper
  ) {
    this.#tokenVendor = tokenVendor;
    this.#globalConfig = globalConfig;
    this.#settingsHelper = settingsHelper;

    if (!globalConfig.requiresSignin) {
      this.#state = { status: "anonymous" };
      return;
    }

    const token = tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
    if (token.state === "signedout") {
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
  async token(): Promise<ValidTokenResult | SignedOutTokenResult> {
    const token = this.#tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
    if (token.state === "expired") {
      return token.refresh();
    }
    return token;
  }

  async #getConnection(): Promise<Connection | undefined> {
    const httpRes = await fetch(
      new URL("list", this.#globalConfig.connectionServerUrl),
      {
        credentials: "include",
      }
    );
    if (!httpRes.ok) {
      return;
    }
    const list = (await httpRes.json()) as ListConnectionsResponse;
    const connection = list.connections.find(
      (connection) => connection.id == SIGN_IN_CONNECTION_ID
    );
    if (!connection) {
      return;
    }
    return connection;
  }

  async getSigninUrl(): Promise<string> {
    if (this.#state.status !== "signedout") return "";

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
}
