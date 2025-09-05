/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import {
  JsonSerializableRequestInit,
  McpClient,
  McpProxyRequest,
} from "./types.js";
import { McpBuiltInServerStore } from "./server-store.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Outcome, TokenGetter } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { ProxyBackedClient } from "./proxy-backed-client.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";

export { McpClientFactory };

const BUILTIN_SERVER_PREFIX = "builtin:";

export type CreateClientOptions = {
  proxyUrl: string;
};

class McpClientFactory {
  constructor(
    private readonly tokenGetter: TokenGetter,
    private readonly proxyUrl?: string
  ) {}

  #fetch(): FetchLike {
    const proxyURL = new URL("/api/mcp-proxy", window.location.href);
    return async (url: string | URL, init?: RequestInit) => {
      const accessToken = await this.tokenGetter();
      if (!ok(accessToken)) {
        throw new Error(accessToken.$error);
      }

      const { signal, headers, ...noSignalInit } = init || {};
      let headersObj: Record<string, string> = {};
      if (headers) {
        if (headers instanceof Headers) {
          headers.forEach((value, key) => {
            headersObj[key] = value;
          });
        } else if (Array.isArray(headers)) {
          headers.forEach(([value, key]) => {
            headersObj[key] = value;
          });
        } else {
          headersObj = headers;
        }
      }
      // TODO: Check request for being serializable
      const request: McpProxyRequest = {
        url: typeof url === "string" ? url : url.href,
        init: {
          ...noSignalInit,
          headers: headersObj,
        } as JsonSerializableRequestInit,
      };
      return fetch(proxyURL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify(request),
      });
    };
  }

  async createClient(
    url: string,
    info: Implementation
  ): Promise<Outcome<McpClient>> {
    const isBuiltIn = url.startsWith(BUILTIN_SERVER_PREFIX);

    try {
      if (isBuiltIn) {
        const client = new Client(info) as McpClient;
        const builtInServerName = url.slice(BUILTIN_SERVER_PREFIX.length);
        const server = McpBuiltInServerStore.instance.get(builtInServerName);
        if (!ok(server)) return server;
        const [clientTransport, serverTransport] =
          InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);
        const transport = clientTransport;

        await client.connect(transport);
        return client;
      } else if (this.proxyUrl) {
        const accessToken = await this.tokenGetter();
        if (!ok(accessToken)) return accessToken;

        return new ProxyBackedClient({
          name: "MCP Proxy Backend",
          url: url,
          proxyToken: accessToken,
          proxyUrl: this.proxyUrl,
        });
      } else {
        const client = new Client(info) as McpClient;

        const transport = new StreamableHTTPClientTransport(new URL(url), {
          fetch: this.#fetch(),
        });

        // TODO: Implement error handling and retry.
        await client.connect(transport);
        return client;
      }
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
