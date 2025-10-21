/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OAuthStateParameter {
  nonce: string;
}

export function oauthTokenBroadcastChannelName(nonce: string): string {
  return `oauth_token_${nonce}`;
}

export interface TokenGrant {
  client_id: string;
  access_token: string;
  expires_in: number;
  issue_time: number;
  picture?: string;
  name?: string;
  id?: string;
}
