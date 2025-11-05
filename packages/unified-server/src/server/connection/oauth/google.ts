/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConnectionConfig } from "../config.js";

export function createConnection(
  clientId: string,
  clientSecret: string,
  scopes: string[]
): ConnectionConfig {
  return {
    oauth: {
      client_id: clientId,
      client_secret: clientSecret,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      scopes,
    },
  };
}
