/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err } from "@breadboard-ai/utils";
import { Outcome } from "@breadboard-ai/types";
import { McpBuiltInServerEntry, McpClient, McpServerInfo } from "./types.js";
import { SimpleMemoryServer } from "./simple-memory.js";

export { McpBuiltInServerStore, listBuiltInMcpServers };

const BUILTIN_SERVERS: Map<string, McpBuiltInServerEntry> = new Map([
  ["memory", new SimpleMemoryServer()],
]);

function listBuiltInMcpServers(): ReadonlyArray<McpServerInfo> {
  return [...BUILTIN_SERVERS.values()].map((value) => value.info);
}

class McpBuiltInServerStore {
  get(name: string): Outcome<McpClient> {
    const entry = BUILTIN_SERVERS.get(name);
    if (entry) {
      return entry.client;
    }
    return err(`Unknown built-in server "${name}"`);
  }

  static instance = new McpBuiltInServerStore();
}
