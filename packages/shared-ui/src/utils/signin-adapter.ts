/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Connection,
  GrantResponse,
  ListConnectionsResponse,
  TokenGrant,
  TokenVendor,
} from "@breadboard-ai/connection-client";
import { Environment } from "../contexts/environment";
import {
  OAuthStateParameter,
  oauthTokenBroadcastChannelName,
} from "../elements/connection/connection-common";
import { SETTINGS_TYPE, SettingsHelper } from "../types/types";
import { createContext } from "@lit/context";
import { getEmbedderRedirectUri } from "./embed-helpers";

export { SigninAdapter };

export const SIGN_IN_CONNECTION_ID = "$sign-in";

/**
 * The three states are:
 *
 * - "anonymous" -- the runtime is not configured to use the sign in.
 * - "signedout" -- the user is not yet signed in or has signed out, but the
 *                  runtime is configured to use sign in.
 * - "signedin" -- the user is currently signed in.
 */
export type SigninState = "signedout" | "signedin" | "anonymous";

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
class SigninAdapter {
  static #cachedPicture: string | null | undefined;
  readonly #tokenVendor: TokenVendor;
  readonly #environment: Environment;
  readonly #settingsHelper: SettingsHelper;

  #nonce = crypto.randomUUID();

  #state: SigninState;
  get state() {
    return this.#state;
  }
  readonly picture?: string;
  readonly id?: string;
  readonly name?: string;

  constructor(
    tokenVendor: TokenVendor,
    environment: Environment,
    settingsHelper: SettingsHelper,
    public readonly errorMessage?: string
  ) {
    this.#tokenVendor = tokenVendor;
    this.#environment = environment;
    this.#settingsHelper = settingsHelper;

    if (!environment.requiresSignin) {
      this.#state = "anonymous";
      return;
    }
    const token = tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
    const { state } = token;
    if (state === "signedout") {
      this.#state = "signedout";
      return;
    }
    const { grant } = token;

    this.#state = "signedin";
    this.picture = grant.picture;
    this.id = grant.id;
    this.name = grant.name;
  }

  accessToken(): string | null {
    if (this.state === "signedin") {
      const token = this.#tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
      if (token.state === "valid") {
        return token.grant.access_token;
      }
    }
    return null;
  }

  async cachedPicture(): Promise<string | undefined> {
    if (SigninAdapter.#cachedPicture === undefined && this.picture) {
      try {
        const token = await this.refresh();
        if (!token || token.state === "signedout") {
          SigninAdapter.#cachedPicture = null;
          return;
        }
        const picture = await fetch(this.picture, {
          headers: {
            Authorization: `Bearer ${token.grant.access_token}`,
          },
        });
        if (!picture.ok) {
          SigninAdapter.#cachedPicture = null;
          return;
        }
        const blobURL = URL.createObjectURL(await picture.blob());
        return blobURL;
      } catch (e) {
        console.warn(e);
        SigninAdapter.#cachedPicture = null;
      }
    }
    return SigninAdapter.#cachedPicture || undefined;
  }

  async refresh() {
    const token = this.#tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
    if (token.state === "expired") {
      return token.refresh();
    }
    return token;
  }

  async #getConnection(): Promise<Connection | undefined> {
    const httpRes = await fetch(
      new URL("list", this.#environment.connectionServerUrl),
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
    if (this.state !== "signedout") return "";

    const connection = await this.#getConnection();
    if (!connection) return "";

    let redirectUri = this.#environment.connectionRedirectUrl;
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

  async signIn(): Promise<{ ok: true } | { ok: false; error: string }> {
    const now = Date.now();
    const nonce = this.#nonce;
    // Reset the nonce in case the user signs out and signs back in again, since
    // we don't want to ever mix up different requests.
    setTimeout(
      // TODO(aomarks) This shouldn't be necessary, what's up?
      () => (this.#nonce = crypto.randomUUID()),
      500
    );
    // The OAuth broker page will know to broadcast the token on this unique
    // channel because it also knows the nonce (since we pack that in the OAuth
    // "state" parameter).
    const channelName = oauthTokenBroadcastChannelName(nonce);
    const channel = new BroadcastChannel(channelName);
    const grantResponse = await new Promise<GrantResponse>((resolve) => {
      channel.addEventListener("message", (m) => resolve(m.data), {
        once: true,
      });
    });
    channel.close();
    if (grantResponse.error !== undefined) {
      // TODO(aomarks) Show error info in the UI.
      console.error(grantResponse.error);
      return { ok: false, error: grantResponse.error };
    }

    const connection = await this.#getConnection();
    if (!connection) {
      return { ok: false, error: "Connection not found" };
    }

    const settingsValue: TokenGrant = {
      client_id: connection.clientId,
      access_token: grantResponse.access_token,
      expires_in: grantResponse.expires_in,
      refresh_token: grantResponse.refresh_token,
      issue_time: now,
      name: grantResponse.name,
      picture: grantResponse.picture,
      id: grantResponse.id,
    };
    await this.#settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, connection.id, {
      name: connection.id,
      value: JSON.stringify(settingsValue),
    });
    return { ok: true };
  }

  async signOut(): Promise<void> {
    const connection = await this.#getConnection();
    if (!connection) {
      return;
    }
    await this.#settingsHelper.delete(SETTINGS_TYPE.CONNECTIONS, connection.id);
    this.#state = "signedout";
  }
}
