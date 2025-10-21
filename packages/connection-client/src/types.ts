/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenResult } from "@breadboard-ai/types/oauth.js";
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

export interface Connection {
  id: string;
  clientId: string;
  authUrl: string;
  title: string;
  description?: string;
  icon?: string;
  scopes: Array<{ scope: string; optional: boolean }>;
}
