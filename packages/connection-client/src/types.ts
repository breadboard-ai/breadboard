/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type TokenVendor = {
  getToken(connectionId: string): TokenResult;
};

export type ConnectionEnvironment = {
  connectionServerUrl: string | undefined;
  connectionRedirectUrl: string;
};

/**
 * Represents a store that remembers and recalls the stored grant.
 */
export type GrantStore = {
  get(connectionId: string): string | undefined;
  set(connectionId: string, grant: string): Promise<void>;
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
  expired?: never;
  refresh?: never;
}

/**
 * The user is signed-in to this service, but the token we have is expired. Call
 * the `refresh` method to automatically refresh it.
 */
export interface ExpiredTokenResult {
  state: "expired";
  grant?: TokenGrant;
  expired?: never;
  refresh: (opts?: { signal?: AbortSignal }) => Promise<ValidTokenResult>;
}

/**
 * The user is not signed-in to this service. In this case, typically a
 * `<bb-connection-signin>` element should be displayed to prompt the user to
 * sign-in.
 */
export interface SignedOutTokenResult {
  state: "signedout";
  grant?: never;
  expired?: never;
  refresh?: never;
}

// IMPORTANT: Keep in sync with
// breadboard/packages/connection-server/src/config.ts
export type GrantResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
      refresh_token: string;
      picture?: string;
      name?: string;
      id?: string;
    };

export interface TokenGrant {
  client_id: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  issue_time: number;
  picture?: string;
  name?: string;
  id?: string;
}

export type RefreshResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
    };

// IMPORTANT: Keep in sync with
// breadboard/packages/connection-server/src/api/refresh.ts
export interface RefreshRequest {
  connection_id: string;
  refresh_token: string;
}

// IMPORTANT: Keep in sync with
// breadboard/packages/connection-server/src/api/list.ts
export interface ListConnectionsResponse {
  connections: Connection[];
}

export interface Connection {
  id: string;
  clientId: string;
  authUrl: string;
  title: string;
  description?: string;
  icon?: string;
}
