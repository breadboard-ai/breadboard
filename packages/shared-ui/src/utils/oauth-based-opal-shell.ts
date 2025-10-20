/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenGrant } from "@breadboard-ai/connection-client";
import { ALWAYS_REQUIRED_OAUTH_SCOPES } from "@breadboard-ai/connection-client/oauth-scopes.js";
import type { GrantResponse } from "@breadboard-ai/types/oauth.js";
import type {
  OpalShellProtocol,
  SignInResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { SettingsHelperImpl } from "../data/settings-helper.js";
import { SettingsStore } from "../data/settings-store.js";
import {
  oauthTokenBroadcastChannelName,
  type OAuthStateParameter,
} from "../elements/connection/connection-common.js";
import { SETTINGS_TYPE } from "../types/types.js";
import { getEmbedderRedirectUri } from "./embed-helpers.js";
import { SIGN_IN_CONNECTION_ID } from "./signin-adapter.js";

export class OAuthBasedOpalShell implements OpalShellProtocol {
  readonly #nonceToScopes = new Map<string, string[]>();

  async ping() {
    console.debug("opal shell host received ping");
    return "pong" as const;
  }

  async fetchWithCreds(_url: string): Promise<unknown> {
    // TODO(aomarks) Implement.
    throw new Error("Not yet implemented");
  }

  async generateSignInUrlAndNonce(
    scopes: string[] = []
  ): Promise<{ url: string; nonce: string }> {
    console.info("[shell host] Generating sign-in URL and nonce");
    const nonce = crypto.randomUUID();
    const uniqueScopes = [
      ...new Set([...ALWAYS_REQUIRED_OAUTH_SCOPES, ...scopes]),
    ];
    this.#nonceToScopes.set(nonce, uniqueScopes);
    const url = new URL("https://accounts.google.com/o/oauth2/auth");
    const params = url.searchParams;
    params.set("client_id", CLIENT_DEPLOYMENT_CONFIG.OAUTH_CLIENT);
    params.set(
      "redirect_uri",
      getEmbedderRedirectUri() ??
        new URL("/oauth/", window.location.origin).href
    );
    params.set("scope", uniqueScopes.join(" "));
    params.set(
      "state",
      JSON.stringify({ nonce } satisfies OAuthStateParameter)
    );
    params.set("response_type", "code");
    params.set("access_type", "offline");
    // Force re-consent every time, because we always want a refresh token.
    params.set("prompt", "consent");
    // Don't lose access to scopes we've previously asked for.
    params.set("include_granted_scopes", "true");
    return { url: url.href, nonce };
  }

  async listenForSignIn(nonce: string): Promise<SignInResult> {
    console.info(`[shell host] Listening for sign in`);
    const scopes = this.#nonceToScopes.get(nonce);
    if (!scopes) {
      return {
        ok: false,
        error: { code: "other", userMessage: "Unexpected sign-in attempt" },
      };
    }
    this.#nonceToScopes.delete(nonce);
    // The OAuth broker page will know to broadcast the token on this unique
    // channel because it also knows the nonce (since we pack that in the OAuth
    // "state" parameter).
    const channelName = oauthTokenBroadcastChannelName(nonce);
    const channel = new BroadcastChannel(channelName);
    console.info(`[shell host] Awaiting grant response`, channelName);
    const grantResponse = await new Promise<GrantResponse>((resolve) => {
      channel.addEventListener("message", (m) => resolve(m.data), {
        once: true,
      });
    });
    const issueTime = Date.now();
    console.info(`[shell host] Received grant response`);
    channel.close();
    if (grantResponse.error !== undefined) {
      if (grantResponse.error === "access_denied") {
        console.info(`[shell host] User cancelled sign-in`);
        return { ok: false, error: { code: "user-cancelled" } };
      }
      console.error(`[shell host] Unknown grant error`, grantResponse.error);
      return {
        ok: false,
        error: {
          code: "other",
          userMessage: `Unknown grant error ${JSON.stringify(grantResponse.error)}`,
        },
      };
    }
    if (!grantResponse.access_token) {
      console.error(`[shell host] Missing access token`, grantResponse);
      return {
        ok: false,
        error: { code: "other", userMessage: "Missing access token" },
      };
    }

    console.info(`[shell host] Checking geo restriction`);
    try {
      if (await this.#userHasGeoRestriction(grantResponse.access_token)) {
        console.info(`[shell host] User is geo restricted`);
        return { ok: false, error: { code: "geo-restriction" } };
      }
    } catch (e) {
      console.error("[shell host] Error checking geo access", e);
      return {
        ok: false,
        error: { code: "other", userMessage: `Error checking geo access` },
      };
    }

    // Check for any missing required scopes.
    const requiredScopes = scopes ?? ALWAYS_REQUIRED_OAUTH_SCOPES;
    const actualScopes = new Set(grantResponse.scopes ?? []);
    const missingScopes = requiredScopes.filter(
      (scope) => !actualScopes.has(scope)
    );
    if (missingScopes.length > 0) {
      console.info(`[shell host] Missing scopes`, missingScopes);
      return {
        ok: false,
        error: { code: "missing-scopes", missingScopes },
      };
    }

    const settingsValue: TokenGrant = {
      client_id: CLIENT_DEPLOYMENT_CONFIG.OAUTH_CLIENT,
      access_token: grantResponse.access_token,
      expires_in: grantResponse.expires_in,
      issue_time: issueTime,
      name: grantResponse.name,
      picture: grantResponse.picture,
      id: grantResponse.id,
      domain: grantResponse.domain,
      scopes: grantResponse.scopes,
    };
    console.info("[shell host] Updating storage");

    const settings = await SettingsStore.restoredInstance();
    const settingsHelper = new SettingsHelperImpl(settings);
    try {
      await settingsHelper.set(
        SETTINGS_TYPE.CONNECTIONS,
        SIGN_IN_CONNECTION_ID,
        {
          name: SIGN_IN_CONNECTION_ID,
          value: JSON.stringify(settingsValue),
        }
      );
    } catch (e) {
      console.error("[shell host] Error updating storage", e);
      return {
        ok: false,
        error: { code: "other", userMessage: `Error updating storage` },
      };
    }
    console.info("[shell host] Sign-in complete");
    return { ok: true };
  }

  async #userHasGeoRestriction(token: string): Promise<boolean> {
    const response = await fetch(
      new URL(
        "/v1beta1/checkAppAccess",
        CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT
      ),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} error checking geo restriction`);
    }
    const result = (await response.json()) as { canAccess?: boolean };
    return !result.canAccess;
  }
}
