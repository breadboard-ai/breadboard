/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ServerConfig {
  connections: Map<string, ConnectionConfig>;
  allowedOrigins: Set<string>;
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
    client_secret: string;
    auth_uri: string;
    token_uri: string;
    scopes: string[];
  };
}

export async function loadConnections(
  configFilePath: string
): Promise<Map<string, ConnectionConfig>> {
  const config = JSON.parse(
    await readFile(configFilePath, "utf8")
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
  return connections;
}
