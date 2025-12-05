/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import {
  McpBuiltInClientFactory,
  McpBuiltInClientFactoryContext,
  McpClient,
  McpServerInfo,
  McpServerStore,
} from "./types.js";
import { McpBuiltInServerStore } from "./builtin-server-store.js";
import { Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { ProxyBackedClient } from "./proxy-backed-client.js";
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
    private readonly proxyUrl: string
  ) {
    this.#builtIn = new McpBuiltInServerStore(context, builtInClients);
    this.#serverStore = createMcpServerStore();
  }

  builtInServers(): ReadonlyArray<McpServerInfo> {
    return this.#builtIn.builtInServers();
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
        const serverInfo = await this.#serverStore.get(url);

        return new CachingMcpClient(
          this.#cache,
          url,
          new ProxyBackedClient({
            name: serverInfo?.title || info.name,
            url,
            fetchWithCreds: this.context.fetchWithCreds,
            proxyUrl: this.proxyUrl,
            token: serverInfo?.authToken,
          }),
          this.#serverStore
        );
      } else {
        return err(`Unable to configure MCP Server: no MCP proxy specified`);
      }
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
