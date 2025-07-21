/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { ConnectionConfig, ServerConfig } from "../config.js";
import { okJson } from "../responses.js";

// IMPORTANT: Keep in sync with
// breadboard/packages/visual-editor/src/elements/connection/connection-server.ts
interface ListConnectionsResponse {
  connections: Connection[];
}

interface Connection {
  id: string;
  clientId: string;
  authUrl: string;
  title: string;
  description?: string;
  icon?: string;
  scopes: Array<{ scope: string; optional: boolean }>;
}

/**
 * API which lists the available connections.
 *
 * Takes no parameters. Returns an array of servers.
 */
export async function list(
  _req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
): Promise<void> {
  const response: ListConnectionsResponse = {
    connections: [...config.connections.values()]
      .map((config) => {
        const connection: Connection = {
          id: config.id,
          clientId: config.oauth.client_id,
          authUrl: makeAuthorizationEndpointUrl(config),
          title: config.title ?? config.id,
          scopes: config.oauth.scopes.map((scope) =>
            typeof scope === "string" ? { scope, optional: false } : scope
          ),
        };
        if (config.description) {
          connection.description = config.description;
        }
        if (config.icon) {
          connection.icon = config.icon;
        }
        return connection;
      })
      .sort(({ id: idA }, { id: idB }) => idA.localeCompare(idB)),
  };
  return okJson(res, response);
}

function makeAuthorizationEndpointUrl(config: ConnectionConfig): string {
  const url = new URL(config.oauth.auth_uri);
  const params = url.searchParams;
  params.set("client_id", config.oauth.client_id);
  params.set("scope", config.oauth.scopes.join(" "));
  params.set("response_type", "code");
  params.set("access_type", "offline");
  // Force re-consent every time, because we always want a refresh token.
  params.set("prompt", "consent");
  return url.href;
}
