/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConnectionConfig } from "../config.js";

export function createConnection(
  clientId: string,
  clientSecret: string,
  scopes: string[],
  useTestGaia: boolean
): ConnectionConfig {
  const authUri = useTestGaia
    ? "https://gaiastaging.corp.google.com/o/oauth2/auth"
    : "https://accounts.google.com/o/oauth2/auth";
  const tokenUri = useTestGaia
    ? "https://gaiastaging.corp.google.com/o/oauth2/token"
    : "https://accounts.google.com/o/oauth2/token";
  return {
    oauth: {
      client_id: clientId,
      client_secret: clientSecret,
      auth_uri: authUri,
      token_uri: tokenUri,
      scopes,
    },
  };
}
