/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSimpleMemoryMcpServer } from "./simple-memory.js";
import { err } from "@breadboard-ai/utils";
import { McpServerDescriptor, Outcome } from "@breadboard-ai/types";

export { McpBuiltInServerStore, listBuiltInMcpServers };

type McpServerFactory = () => McpServer;

type McpStoreEntry = {
  descriptor: McpServerDescriptor;
  factory: McpServerFactory;
};

const BUILTIN_SERVERS: Map<string, McpStoreEntry> = new Map([
  [
    "memory",
    {
      descriptor: {
        title: "Simple Memory",
        description:
          "A simple key-value store that can be used as a memory for LLM",
        details: {
          name: "Simple Memory",
          version: "0.0.1",
          url: `builtin:memory`,
        },
        removable: false,
        registered: false,
      },
      factory: createSimpleMemoryMcpServer,
    },
  ],
]);

function listBuiltInMcpServers(): ReadonlyArray<McpServerDescriptor> {
  return [...BUILTIN_SERVERS.values()].map((value) => value.descriptor);
}

class McpBuiltInServerStore {
  get(name: string): Outcome<McpServer> {
    const entry = BUILTIN_SERVERS.get(name);
    if (entry) {
      return entry.factory();
    }
    return err(`Unknown built-in server "${name}"`);
  }

  static instance = new McpBuiltInServerStore();
}
