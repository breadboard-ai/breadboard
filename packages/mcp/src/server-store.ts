/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSimpleMemoryMcpServer } from "./simple-memory.js";
import { err } from "@breadboard-ai/utils";
import { Outcome } from "@breadboard-ai/types";

export { McpBuiltInServerStore };

const BUILTIN_SERVERS = new Map([["memory", createSimpleMemoryMcpServer]]);

class McpBuiltInServerStore {
  get(name: string): Outcome<McpServer> {
    const factory = BUILTIN_SERVERS.get(name);
    if (factory) {
      return factory();
    }
    return err(`Unknown built-in server "${name}"`);
  }

  static instance = new McpBuiltInServerStore();
}
