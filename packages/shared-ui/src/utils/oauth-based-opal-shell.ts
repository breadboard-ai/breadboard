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
  ShareDriveFilesOptions,
  SignInResult,
  SignInState,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { SettingsHelperImpl } from "../data/settings-helper.js";
import { SettingsStore } from "../data/settings-store.js";
import {
  oauthTokenBroadcastChannelName,
  type OAuthStateParameter,
} from "../elements/connection/connection-common.js";
import {
  loadDrivePicker,
  loadDriveShareClient,
  type ShareClient,
} from "../elements/google-drive/google-apis.js";
import { SETTINGS_TYPE } from "../types/types.js";
import { getEmbedderRedirectUri, getTopLevelOrigin } from "./embed-helpers.js";
import "./install-opal-shell-comlink-transfer-handlers.js";
import { scopesFromUrl } from "./scopes-from-url.js";
import { SIGN_IN_CONNECTION_ID } from "./signin-adapter.js";

export class OAuthBasedOpalShell implements OpalShellProtocol {
  readonly #nonceToScopes = new Map<string, string[]>();

  readonly #settingsStore = SettingsStore.restoredInstance();
  readonly #settingsHelper = this.#settingsStore.then(
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

  #state?: Promise<SignInState>;

  async getSignInState(): Promise<SignInState> {
    return (this.#state ??= (async () => {
      const tokenVendor = await this.#tokenVendor;
      const token = tokenVendor.getToken();
      if (token.state === "signedout") {
        return { status: "signedout" };
      }
      token.state satisfies "valid" | "expired";
      return this.#makeSignedInState(token.grant);
    })());
  }

  async validateScopes(): Promise<{ ok: true } | { ok: false; error: string }> {
    const state = await this.getSignInState();
    if (state.status !== "signedin") {
      return { ok: false, error: "User was signed out" };
    }

    const settingsHelper = await this.#settingsHelper;
    const settingsValueStr = (
      await settingsHelper.get(SETTINGS_TYPE.CONNECTIONS, SIGN_IN_CONNECTION_ID)
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
      await settingsHelper.set(
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
    const token = await this.#getToken();
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
    const token = await this.#getToken(scopes);
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
    const writeSettings = () =>
      settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, SIGN_IN_CONNECTION_ID, {
        name: SIGN_IN_CONNECTION_ID,
        value: JSON.stringify(settingsValue),
      });
    try {
      await writeSettings();
    } catch (e1) {
      console.warn(
        "[shell host] Error updating storage, deleting storage and retrying:",
        e1
      );
      try {
        const settingsStore = await this.#settingsStore;
        await settingsStore.delete();
        await writeSettings();
      } catch (e2) {
        console.error(
          "[shell host] Error updating storage even after deleting:",
          e2
        );
        return {
          ok: false,
          error: {
            code: "other",
            userMessage: `Error updating storage after delete`,
          },
        };
      }
    }

    const state = this.#makeSignedInState(settingsValue);
    this.#state = Promise.resolve(state);
    console.info("[shell host] Sign-in complete");
    return { ok: true, state };
  }

  #makeSignedInState(grant: TokenGrant): SignInState {
    return {
      status: "signedin",
      id: grant.id,
      name: grant.name,
      picture: grant.picture,
      domain: grant.domain,
      scopes: (grant.scopes ?? []).map((scope) =>
        canonicalizeOAuthScope(scope)
      ),
    };
  }

  async signOut(): Promise<void> {
    if ((await this.getSignInState()).status === "signedout") {
      return;
    }
    const settingsHelper = await this.#settingsHelper;
    await settingsHelper.delete(
      SETTINGS_TYPE.CONNECTIONS,
      SIGN_IN_CONNECTION_ID
    );
    this.#state = Promise.resolve({ status: "signedout" });
  }

  async #getToken(): Promise<ValidTokenResult | SignedOutTokenResult>;
  async #getToken(
    scopes: string[]
  ): Promise<
    ValidTokenResult | SignedOutTokenResult | MissingScopesTokenResult
  >;
  async #getToken(
    scopes?: string[]
  ): Promise<
    ValidTokenResult | SignedOutTokenResult | MissingScopesTokenResult
  > {
    const tokenVendor = await this.#tokenVendor;
    let token = tokenVendor.getToken();
    if (token.state === "expired") {
      token = await token.refresh();
    }
    if (token.state === "valid" && scopes?.length) {
      const actualScopes = new Set(
        (token.grant.scopes ?? []).map((scope) => canonicalizeOAuthScope(scope))
      );
      const missingScopes = scopes.filter(
        (scope) => !actualScopes.has(canonicalizeOAuthScope(scope))
      );
      if (missingScopes.length) {
        return { state: "missing-scopes", scopes: missingScopes };
      }
    }
    return token;
  }

  async setUrl(url: string): Promise<void> {
    // Project the guest path under our host path.
    //
    // Note that parent windows and iframes have a common history, so because we
    // want the iframe to be completely in control of history, we always want to
    // replace here instead of pushing, otherwise we'd break back/forward.
    const { pathname, search, hash } = new URL(url);
    history.replaceState(
      null,
      "",
      // TODO(aomarks) When ready, invert this relationship. The host will serve
      // at / and the guest will serve at /guest.
      "/shell" + pathname + search + hash
    );
  }

  async pickDriveFiles(
    options: PickDriveFilesOptions
  ): Promise<PickDriveFilesResult> {
    console.info(`[shell host] opening drive picker`);
    const [pickerLib, token] = await Promise.all([
      loadDrivePicker(),
      this.#getToken(["https://www.googleapis.com/auth/drive.readonly"]),
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

  /**
   * Re-use the same ShareClient instance across all calls to
   * {@link shareDriveFiles} because it always dumps bunch of new DOM into the
   * body every time it's opened, and never cleans it up.
   */
  #shareClient?: ShareClient;

  async shareDriveFiles(options: ShareDriveFilesOptions): Promise<void> {
    const tokenPromise = this.#getToken([
      "https://www.googleapis.com/auth/drive.file",
    ]);
    if (!this.#shareClient) {
      const ShareClient = await loadDriveShareClient();
      this.#shareClient = new ShareClient();
    }
    const token = await tokenPromise;
    if (token.state !== "valid") {
      throw new Error("User is signed-out or doesn't have sufficient scope");
    }

    this.#shareClient.setItemIds(options.fileIds);
    this.#shareClient.setOAuthToken(token.grant.access_token);

    let status: "opening" | "open" | "closed" = "opening";
    let observer: MutationObserver | undefined = undefined;
    const keydownListenerAborter = new AbortController();
    const closed = Promise.withResolvers<void>();

    const cleanupAndClose = () => {
      observer?.disconnect();
      keydownListenerAborter.abort();
      status = "closed";
      closed.resolve();
    };

    // Weirdly, there is no API for getting the dialog element, or for finding
    // out when the user closes it. Upon opening, a bunch of DOM gets added to
    // document.body. Upon closing, that DOM stays there forever, but becomes
    // hidden. So, as a hack, we can use a MutationObserver to notice these
    // things happening.
    observer = new MutationObserver(() => {
      const dialog = document.body.querySelector(
        `[guidedhelpid="drive_share_dialog"]`
      );
      if (dialog) {
        const ariaHidden = dialog.getAttribute("aria-hidden");
        if (status === "opening" && ariaHidden !== "true") {
          status = "open";
        } else if (status === "open" && ariaHidden === "true") {
          cleanupAndClose();
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
    });

    window.addEventListener(
      "keydown",
      ({ key }) => {
        if (key === "Escape" && status === "opening") {
          // This handles an edge case where the user presses Escape before the
          // ShareClient has finished loading, which means the MutationObserver
          // logic below won't fire.
          cleanupAndClose();
        }
      },
      {
        // Capture so that we see this event before the ShareClient.
        capture: true,
        signal: keydownListenerAborter.signal,
      }
    );

    this.#shareClient.showSettingsDialog();
    await closed.promise;
  }

  async checkAppAccess(): Promise<CheckAppAccessResult> {
    const token = await this.#getToken();
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
