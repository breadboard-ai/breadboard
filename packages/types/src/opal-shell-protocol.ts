/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpalShellProtocol {
  ping(): Promise<"pong">;

  fetchWithCreds(url: string): Promise<unknown>;

  generateSignInUrlAndNonce(
    // TODO(aomarks) Move OAuthScope to types
    scopes: string[]
  ): Promise<{ url: string; nonce: string }>;

  listenForSignIn(nonce: string): Promise<SignInResult>;
}

export type SignInResult = { ok: true } | { ok: false; error: SignInError };

export type SignInError =
  | { code: "missing-scopes"; missingScopes: string[] }
  | { code: "geo-restriction" }
  | { code: "user-cancelled" }
  | { code: "other"; userMessage: string };
