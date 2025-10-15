/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "node:fs/promises";

import * as flags from "./flags.js";
import * as googleOauth from "./oauth/google.js";

import type { GrantResponse } from "@breadboard-ai/types/oauth.js";

export interface ServerConfig {
  connection: ConnectionConfig;
  allowedOrigins: string[];
  refreshTokenCookieSameSite: flags.SameSite;
  validateResponse?: (
    response: GrantResponse
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
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
 * Create the connection config, either from file or environment.
 *
 * If the CONNECTIONS_FILE flag is set, the connections config will be loaded
 * from a JSON file at that location. An error will be raised if the file
 * cannot be read.
 *
 * Otherwise, assuming the OAUTH_CLIENT flag is set, the connection will be
 * created for a Google OAuth client based on the OAUTH_CLIENT, OAUTH_SECRET,
 * and OAUTH_SCOPES flags.
 *
 * Throws if neither flag is set.
 */
export async function createConnectionConfig(): Promise<ConnectionConfig> {
  if (flags.CONNECTIONS_FILE) {
    return loadConnectionsFile();
  }
  if (!flags.OAUTH_CLIENT) {
    throw new Error(`Either CONNECTIONS_FILE or OAUTH_CLIENT must be set`);
  }

  console.log(
    `[connection-server startup] Creating connection config for [${flags.OAUTH_CLIENT}]`
  );
  return googleOauth.createConnection(
    flags.OAUTH_CLIENT,
    flags.OAUTH_SECRET,
    flags.OAUTH_SCOPES
  );
}

async function loadConnectionsFile(): Promise<ConnectionConfig> {
  console.log(
    `[connection-server startup] Loading connections file from ${flags.CONNECTIONS_FILE}`
  );

  const config = JSON.parse(
    await readFile(flags.CONNECTIONS_FILE, "utf8")
  ) as ConnectionsConfigFile;

  const connection = config.connections[0];
  if (!connection) {
    throw new Error(
      `Expected connections file to contain at least one connection`
    );
  }
  if (config.connections.length > 1) {
    console.warn(
      `Connection file contained more than one connection. ` +
        `Only the first one is being used.`
    );
  }

  loadSecret(connection);
  return connection;
}

/**
 * Load a secret from file if client_secret_location is set.
 *
 * Fails with an error if any secret scan't be read.
 */
async function loadSecret(connection: ConnectionConfig): Promise<void> {
  const secretLocation = connection.oauth.client_secret_location;
  if (secretLocation) {
    console.log(`Loading client secret from ${secretLocation}`);
    connection.oauth.client_secret = await readFile(secretLocation, "utf8");
  }
}
