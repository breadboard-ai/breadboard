/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, ok } from "@breadboard-ai/utils";
import { Outcome, TokenGetter } from "@breadboard-ai/types";
import {
  McpBuiltInClient,
  McpBuiltInClientFactory,
  McpClient,
  McpServerInfo,
} from "./types.js";

export { McpBuiltInServerStore };

const BUILTIN_SERVER_PREFIX = "builtin:";

class McpBuiltInServerStore {
  #clients: Map<string, McpBuiltInClient> = new Map();
  #clientFactories: Map<string, McpBuiltInClientFactory>;

  constructor(
    private readonly tokenGetter: TokenGetter,
    clientFactories: [string, McpBuiltInClientFactory][]
  ) {
    this.#clientFactories = new Map(clientFactories);
  }

  isBuiltIn(url?: string) {
    return url?.startsWith(BUILTIN_SERVER_PREFIX);
  }

  builtInServers(): ReadonlyArray<McpServerInfo> {
    const servers: McpServerInfo[] = [];
    this.#clientFactories.forEach((_factory, name) => {
      const client = this.#getOrCreateClient(name);
      if (!ok(client)) return;

      servers.push(client.info);
    });
    return servers;
  }

  #getOrCreateClient(name: string): Outcome<McpBuiltInClient> {
    let client = this.#clients.get(name);
    if (!client) {
      const factory = this.#clientFactories.get(name);
      if (!factory) {
        return err(`Unknown built-in server "${name}"`);
      }
      client = factory(this.tokenGetter);
      this.#clients.set(name, client);
    }
    return client;
  }

  get(url: string): Outcome<McpClient> {
    const name = url.slice(BUILTIN_SERVER_PREFIX.length);
    return this.#getOrCreateClient(name);
  }
}
