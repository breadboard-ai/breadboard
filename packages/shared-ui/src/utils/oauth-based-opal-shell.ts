/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import {
  ALWAYS_REQUIRED_OAUTH_SCOPES,
  canonicalizeOAuthScope,
} from "@breadboard-ai/connection-client/oauth-scopes.js";
import { TokenVendorImpl } from "@breadboard-ai/connection-client/token-vendor.js";
import type {
  GrantResponse,
  MissingScopesTokenResult,
  SignedOutTokenResult,
  TokenGrant,
  ValidTokenResult,
} from "@breadboard-ai/types/oauth.js";
import type {
  CheckAppAccessResult,
  OpalShellProtocol,
  PickDriveFilesOptions,
  PickDriveFilesResult,
  SignInResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { SettingsHelperImpl } from "../data/settings-helper.js";
import { SettingsStore } from "../data/settings-store.js";
import {
  oauthTokenBroadcastChannelName,
  type OAuthStateParameter,
} from "../elements/connection/connection-common.js";
import { loadDrivePicker } from "../elements/google-drive/google-apis.js";
import { SETTINGS_TYPE } from "../types/types.js";
import { getEmbedderRedirectUri, getTopLevelOrigin } from "./embed-helpers.js";
import "./install-opal-shell-comlink-transfer-handlers.js";
import { scopesFromUrl } from "./scopes-from-url.js";
import { SIGN_IN_CONNECTION_ID } from "./signin-adapter.js";

export class OAuthBasedOpalShell implements OpalShellProtocol {
  readonly #nonceToScopes = new Map<string, string[]>();

  readonly #settingsHelper = SettingsStore.restoredInstance().then(
    (settings) => new SettingsHelperImpl(settings)
  );

  readonly #tokenVendor = this.#settingsHelper.then(
    (settingsHelper) =>
      new TokenVendorImpl(
        {
          get: () =>
            settingsHelper.get(SETTINGS_TYPE.CONNECTIONS, SIGN_IN_CONNECTION_ID)
              ?.value as string,
          set: async (grant: string) =>
            settingsHelper.set(
              SETTINGS_TYPE.CONNECTIONS,
              SIGN_IN_CONNECTION_ID,
              {
                name: SIGN_IN_CONNECTION_ID,
                value: grant,
              }
            ),
        },
        { OAUTH_CLIENT: CLIENT_DEPLOYMENT_CONFIG.OAUTH_CLIENT }
      )
  );

  async fetchWithCreds(
    input: string | URL | RequestInfo,
    init: RequestInit = {}
  ): Promise<Response> {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : input;
    try {
      new URL(url);
    } catch {
      // Don't allow relative URLs, because it's ambiguous which origin we
      // should resolve it against (the host or guest?).
      return new Response(
        `Only valid absolute URLs can be used with fetchWithCreds: ${url}`,
        { status: 400 }
      );
    }
    const scopes = scopesFromUrl(
      url,
      CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT
    );
    if (!scopes) {
      const message = `URL is not in fetchWithCreds allowlist: ${url}`;
      console.error(`[shell host] ${message}`);
      return new Response(message, { status: 403 });
    }
    const token = await this.getToken(scopes);
    if (token.state === "signedout") {
      return new Response("User is signed-out", { status: 401 });
    }
    if (token.state === "missing-scopes") {
      return new Response(
        `User is signed-in but missing scopes: ${token.scopes.join(", ")}`,
        { status: 401 }
      );
    }
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token.grant.access_token}`);
    return fetch(input, { ...init, headers });
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
      const access = await this.#checkAppAccessWithToken(
        grantResponse.access_token
      );
      if (!access.canAccess) {
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

    const settingsHelper = await this.#settingsHelper;
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

  async signOut(): Promise<void> {
    const settingsHelper = await this.#settingsHelper;
    await settingsHelper.delete(
      SETTINGS_TYPE.CONNECTIONS,
      SIGN_IN_CONNECTION_ID
    );
  }

  async getToken(
    scopes?: string[]
  ): Promise<
    ValidTokenResult | SignedOutTokenResult | MissingScopesTokenResult
  > {
    const tokenVendor = await this.#tokenVendor;
    let token = tokenVendor.getToken();
    if (token.state === "expired") {
      token = await token.refresh();
    }
    if (token.state === "valid") {
      if (scopes?.length) {
        const actualScopes = new Set(
          (token.grant.scopes ?? []).map((scope) =>
            canonicalizeOAuthScope(scope)
          )
        );
        const missingScopes = scopes.filter(
          (scope) => !actualScopes.has(canonicalizeOAuthScope(scope))
        );
        if (missingScopes.length) {
          return { state: "missing-scopes", scopes: missingScopes };
        }
      }
    }
    return token;
  }

  async setUrl(url: string): Promise<void> {
    const obj = new URL(url);
    // Project the guest path under our host path.
    //
    // TODO(aomarks) When ready, invert this relationship. The host will serve
    // at / and the guest will serve at /guest.
    obj.pathname = `/shell${obj.pathname}`;
    url = obj.href;
    // Note that parent windows and iframes have a common history, so because we
    // want the iframe to be completely in control of history, we always want to
    // replace here instead of pushing, otherwise we'd break back/forward.
    history.replaceState(null, "", url);
  }

  async pickDriveFiles(
    options: PickDriveFilesOptions
  ): Promise<PickDriveFilesResult> {
    console.info(`[shell host] opening drive picker`);
    const [pickerLib, token] = await Promise.all([
      loadDrivePicker(),
      this.getToken(["https://www.googleapis.com/auth/drive.readonly"]),
    ]);
    if (token.state !== "valid") {
      return {
        action: "error",
        error: `Could not open drive picker with token state ${token.state}`,
      };
    }

    // See https://developers.google.com/drive/picker/reference

    const myFilesView = new pickerLib.DocsView();
    myFilesView.setMimeTypes(options.mimeTypes.join(","));
    myFilesView.setIncludeFolders(true);
    myFilesView.setSelectFolderEnabled(false);
    myFilesView.setOwnedByMe(true);
    myFilesView.setMode(google.picker.DocsViewMode.GRID);

    const sharedFilesView = new pickerLib.DocsView();
    sharedFilesView.setMimeTypes(options.mimeTypes.join(","));
    sharedFilesView.setIncludeFolders(true);
    sharedFilesView.setSelectFolderEnabled(false);
    sharedFilesView.setOwnedByMe(false);
    sharedFilesView.setMode(google.picker.DocsViewMode.GRID);

    const result = await new Promise<google.picker.ResponseObject>(
      (resolve) => {
        new pickerLib.PickerBuilder()
          .setOrigin(getTopLevelOrigin())
          .addView(myFilesView)
          .addView(sharedFilesView)
          .setAppId(token.grant.client_id)
          .setOAuthToken(token.grant.access_token)
          .setCallback((response) => {
            if (response.action !== "loaded") {
              resolve(response);
            }
          })
          .build()
          .setVisible(true);
      }
    );

    console.info(`[shell host] drive picker result`, result);
    if (result.action === "picked") {
      return { action: "picked", docs: result.docs ?? [] };
    } else if (result.action === "cancel") {
      return { action: "cancel" };
    } else if (result.action === "error") {
      return { action: "error", error: "Unknown error from drive picker" };
    } else {
      return {
        action: "error",
        error: `Unhandled result action ${result.action}`,
      };
    }
  }

  async checkAppAccess(): Promise<CheckAppAccessResult> {
    const token = await this.getToken();
    if (token.state === "valid") {
      return await this.#checkAppAccessWithToken(token.grant.access_token);
    } else {
      return { canAccess: false };
    }
  }

  async #checkAppAccessWithToken(token: string): Promise<CheckAppAccessResult> {
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
    return { canAccess: !!result.canAccess };
  }
}
