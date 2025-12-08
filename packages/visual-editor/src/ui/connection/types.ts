/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
