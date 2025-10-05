/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import {
  JsonSerializableRequestInit,
  McpBuiltInClientFactory,
  McpBuiltInClientFactoryContext,
  McpClient,
  McpProxyRequest,
  McpServerInfo,
  McpServerStore,
} from "./types.js";
import { McpBuiltInServerStore } from "./builtin-server-store.js";
import { Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { ProxyBackedClient } from "./proxy-backed-client.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CachingMcpClient } from "./caching-mcp-client.js";
import { createMcpServerStore } from "./server-store.js";

export { McpClientManager };

class McpClientManager {
  #cache: Map<string, CachingMcpClient> = new Map();
  #builtIn: McpBuiltInServerStore;
  #serverStore: McpServerStore;

  constructor(
    builtInClients: [string, McpBuiltInClientFactory][],
    private readonly context: McpBuiltInClientFactoryContext,
    private readonly proxyUrl?: string
  ) {
    this.#builtIn = new McpBuiltInServerStore(context, builtInClients);
    this.#serverStore = createMcpServerStore();
  }

  builtInServers(): ReadonlyArray<McpServerInfo> {
    return this.#builtIn.builtInServers();
  }

  #fetch(): FetchLike {
    const proxyURL = new URL("/api/mcp-proxy", window.location.href);
    return async (url: string | URL, init?: RequestInit) => {
      const accessToken = await this.context.tokenGetter();
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
    const client = this.#cache.get(url);
    if (client) {
      return client;
    }

    const isBuiltIn = this.#builtIn.isBuiltIn(url);

    try {
      if (isBuiltIn) {
        return this.#builtIn.get(url);
      } else if (this.proxyUrl) {
        const accessToken = await this.context.tokenGetter();
        const serverInfo = await this.#serverStore.get(url);
        if (!ok(accessToken)) return accessToken;

        return new CachingMcpClient(
          this.#cache,
          url,
          new ProxyBackedClient({
            name: serverInfo?.title || info.name,
            url,
            proxyToken: accessToken,
            proxyUrl: this.proxyUrl,
            token: serverInfo?.authToken,
          }),
          this.#serverStore
        );
      } else {
        const client = new Client(info) as McpClient;

        const transport = new StreamableHTTPClientTransport(new URL(url), {
          fetch: this.#fetch(),
        });

        // TODO: Implement error handling and retry.
        await client.connect(transport);
        return new CachingMcpClient(
          this.#cache,
          url,
          client,
          this.#serverStore
        );
      }
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
