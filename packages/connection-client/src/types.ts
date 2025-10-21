/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenGrant } from "@breadboard-ai/types/oauth.js";
import type { OAuthScope } from "./oauth-scopes.js";

export type TokenVendor = {
  getToken(scopes?: OAuthScope[]): TokenResult;
  isSignedIn(): boolean;
};

export type ConnectionEnvironment = {
  OAUTH_CLIENT: string;
};

/**
 * Represents a store that remembers and recalls the stored grant.
 */
export type GrantStore = {
  get(): string | undefined;
  set(grant: string | undefined): Promise<void>;
};

export type TokenResult =
  | ValidTokenResult
  | ExpiredTokenResult
  | SignedOutTokenResult;

/**
 * The token is valid and ready to be used.
 */
export interface ValidTokenResult {
  state: "valid";
  grant: TokenGrant;
}

/**
 * The user is signed-in to this service, but the token we have is expired. Call
 * the `refresh` method to automatically refresh it.
 */
export interface ExpiredTokenResult {
  state: "expired";
  grant: TokenGrant;
  refresh: (opts?: { signal?: AbortSignal }) => Promise<TokenResult>;
}

/**
 * The user is not signed-in to this service. In this case, typically a
 * `<bb-connection-signin>` element should be displayed to prompt the user to
 * sign-in.
 */
export interface SignedOutTokenResult {
  state: "signedout";
}

export interface Connection {
  id: string;
  clientId: string;
  authUrl: string;
  title: string;
  description?: string;
  icon?: string;
  scopes: Array<{ scope: string; optional: boolean }>;
}
