/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as flags from "./flags.js";
import * as googleOauth from "./oauth/google.js";

export interface ServerConfig {
  connection: ConnectionConfig;
  allowedOrigins: string[];
  refreshTokenCookieSameSite: flags.SameSite;
}

export interface ConnectionsConfigFile {
  connections: ConnectionConfig[];
}

export interface ConnectionConfig {
  title?: string;
  description?: string;
  icon?: string;
  oauth: {
    client_id: string;
    client_secret?: string;
    client_secret_location?: string;
    auth_uri: string;
    token_uri: string;
    scopes: Array<string | { scope: string; optional: boolean }>;
  };
}

/**
 * Create the connection config
 *
 * The connection will be created for a Google OAuth client based on the
 * OAUTH_CLIENT, OAUTH_SECRET, and OAUTH_SCOPES flags.
 */
export async function createConnectionConfig(): Promise<ConnectionConfig> {
  if (!flags.OAUTH_CLIENT) {
    throw new Error(`The OAUTH_CLIENT environment variable must be set`);
  }

  console.log(
    `[connection-server startup] Creating connection config for [${flags.OAUTH_CLIENT}]`
  );
  return googleOauth.createConnection(
    flags.OAUTH_CLIENT,
    flags.OAUTH_SECRET,
    flags.OAUTH_SCOPES,
    flags.USE_TESTGAIA
  );
}
