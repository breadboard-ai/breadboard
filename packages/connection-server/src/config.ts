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
  connections: Map<string, ConnectionConfig>;
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
  id: string;
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
 * Otherwise, if the OAUTH_CLIENT flag is set, a single connection called
 * "$sign-in" will be created for a Google OAuth client based on the
 * OAUTH_CLIENT, OAUTH_SECRET, and OAUTH_SCOPES flags.
 *
 * If neither flag is set, an empty config is returned.
 */
export async function createConnectionConfig(): Promise<
  Map<string, ConnectionConfig>
> {
  if (flags.CONNECTIONS_FILE) {
    return loadConnections();
  }
  if (!flags.OAUTH_CLIENT) {
    return new Map();
  }

  console.log(
    `[connection-server startup] Creating connection config for [${flags.OAUTH_CLIENT}]`
  );
  const connections = new Map<string, ConnectionConfig>();
  connections.set(
    "$signIn",
    googleOauth.createConnection(
      "$signIn",
      flags.OAUTH_CLIENT,
      flags.OAUTH_SECRET,
      flags.OAUTH_SCOPES
    )
  );
  return connections;
}

async function loadConnections(): Promise<Map<string, ConnectionConfig>> {
  console.log(
    `[connection-server startup] Loading connections file from ${flags.CONNECTIONS_FILE}`
  );

  const config = JSON.parse(
    await readFile(flags.CONNECTIONS_FILE, "utf8")
  ) as ConnectionsConfigFile;
  const connections = new Map();
  for (const connection of config.connections) {
    if (connections.has(connection.id)) {
      console.warn(
        `Connection id ${connection.id} is configured more than once.`
      );
    } else {
      connections.set(connection.id, connection);
    }
  }
  loadSecrets(connections);
  return connections;
}

/**
 * Load secret from file for every secret that has client_secret_location set.
 *
 * Fails with an error if any secret is not found or can't be read.
 */
async function loadSecrets(
  connections: Map<string, ConnectionConfig>
): Promise<void> {
  for (const connection of connections.values()) {
    const secretLocation = connection.oauth.client_secret_location;
    if (secretLocation) {
      console.log(`Loading client secret from ${secretLocation}`);
      connection.oauth.client_secret = await readFile(secretLocation, "utf8");
    }
  }
}
