/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OAuthStateParameter {
  nonce: string;
  connectionId: string;
}

export function oauthTokenBroadcastChannelName(nonce: string): string {
  return `oauth_token_${nonce}`;
}

// IMPORTANT: Keep in sync with
// breadboard/packages/connection-server/src/api/grant.ts
export type GrantResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
      refresh_token: string;
    };

export interface GrantSettingsValue {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  issue_time: number;
}
