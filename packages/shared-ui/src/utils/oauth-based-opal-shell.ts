/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ALWAYS_REQUIRED_OAUTH_SCOPES } from "@breadboard-ai/connection-client/oauth-scopes.js";
import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import type { OAuthStateParameter } from "../elements/connection/connection-common.js";
import { getEmbedderRedirectUri } from "./embed-helpers.js";

export class OAuthBasedOpalShell implements OpalShellProtocol {
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
    const nonce = crypto.randomUUID();
    const url = new URL("https://accounts.google.com/o/oauth2/auth");
    const params = url.searchParams;
    params.set("client_id", CLIENT_DEPLOYMENT_CONFIG.OAUTH_CLIENT);
    params.set(
      "redirect_uri",
      getEmbedderRedirectUri() ??
        new URL("/oauth/", window.location.origin).href
    );
    const uniqueScopes = [
      ...new Set([...ALWAYS_REQUIRED_OAUTH_SCOPES, ...scopes]),
    ];
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
}
