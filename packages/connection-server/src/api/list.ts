/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "../config.js";
import { okJson } from "../responses.js";
import type { OAuthClientSecretData } from "../secrets.js";

// IMPORTANT: Keep in sync with
// breadboard/packages/visual-editor/src/elements/connection/connection-server.ts
interface ListConnectionsResponse {
  connections: Connection[];
}

interface Connection {
  id: string;
  authUrl: string;
  title: string;
  description?: string;
  icon?: string;
}

/**
 * API which lists the available connections.
 *
 * Takes no parameters. Returns an array of servers.
 */
export async function list(
  _req: IncomingMessage,
  res: ServerResponse,
  config: Config
): Promise<void> {
  const response: ListConnectionsResponse = {
    connections: [...config.secrets.entries()]
      .map(([connectionId, config]) => {
        const connection: Connection = {
          id: connectionId,
          authUrl: makeAuthorizationEndpointUrl(connectionId, config),
          title: config.__metadata?.title ?? connectionId,
        };
        if (config.__metadata?.description) {
          connection.description = config.__metadata.description;
        }
        if (config.__metadata?.icon) {
          connection.icon = config.__metadata.icon;
        }
        return connection;
      })
      .sort(({ id: idA }, { id: idB }) => idA.localeCompare(idB)),
  };
  return okJson(res, response);
}

function makeAuthorizationEndpointUrl(
  connectionId: string,
  secretData: OAuthClientSecretData
): string {
  const url = new URL(secretData.web.auth_uri);
  const params = url.searchParams;
  params.set("client_id", secretData.web.client_id);
  params.set("scope", (secretData.__metadata?.scopes ?? []).join(" "));
  params.set("response_type", "code");
  params.set("access_type", "offline");
  // Force re-consent every time, because we always want a refresh token.
  params.set("prompt", "consent");
  return url.href;
}
