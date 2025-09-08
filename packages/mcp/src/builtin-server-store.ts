/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err } from "@breadboard-ai/utils";
import { Outcome, TokenGetter } from "@breadboard-ai/types";
import {
  McpBuiltInClient,
  McpBuiltInClientFactory,
  McpClient,
  McpServerInfo,
} from "./types.js";
import { createSimpleMemoryClient } from "./simple-memory.js";

export { McpBuiltInServerStore };

const BUILTIN_SERVER_PREFIX = "builtin:";

const BUILTIN_SERVERS: Map<string, McpBuiltInClientFactory> = new Map([
  ["memory", createSimpleMemoryClient],
]);

class McpBuiltInServerStore {
  #clients: Map<string, McpBuiltInClient> = new Map();

  constructor(private readonly tokenGetter: TokenGetter) {}

  isBuiltIn(url?: string) {
    return url?.startsWith(BUILTIN_SERVER_PREFIX);
  }

  builtInServers(): ReadonlyArray<McpServerInfo> {
    const servers: McpServerInfo[] = [];
    BUILTIN_SERVERS.forEach((_factory, name) => {
      const info = this.#clients.get(name)?.info;
      if (info) {
        servers.push(info);
      }
    });
    return servers;
  }

  get(url: string): Outcome<McpClient> {
    const name = url.slice(BUILTIN_SERVER_PREFIX.length);

    let client = this.#clients.get(name);
    if (!client) {
      const factory = BUILTIN_SERVERS.get(name);
      if (!factory) {
        return err(`Unknown built-in server "${name}"`);
      }
      client = factory(this.tokenGetter);
      this.#clients.set(name, client);
    }
    return client;
  }
}
