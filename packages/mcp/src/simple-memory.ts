/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export { createSimpleMemoryMcpServer };

const memory = new Map<string, string>();

function createSimpleMemoryMcpServer() {
  const server = new McpServer({
    title: "Simple Memory",
    name: "Simple Memory",
    version: "0.0.1",
  });

  server.registerTool(
    "store",
    {
      title: "Store value with a key",
      description:
        "Stores value in a key-value memory store, using the key specifed",
      inputSchema: {
        key: z.string().describe("Key to store the value"),
        value: z.string().describe("Value to store"),
      },
    },
    async ({ key, value }) => {
      memory.set(key, value);
      return {
        content: [{ type: "text", text: `Successfully stored key "${key}"` }],
      };
    }
  );

  server.registerTool(
    "storeEntries",
    {
      title: "Store multiple key-value pairs",
      description: "Stores multiple key-value pairs in key-value memory store",
      inputSchema: {
        entries: z.array(
          z.object({
            key: z.string().describe("The key of the entry"),
            value: z.string().describe("The value of the entry"),
          })
        ),
      },
    },
    async ({ entries }) => {
      entries.forEach(({ key, value }) => {
        memory.set(key, value);
      });
      return {
        content: [
          { type: "text", text: "Successfully stored multiple entries" },
        ],
      };
    }
  );

  server.registerTool(
    "retrieve",
    {
      title: "Retrieve value by key",
      description:
        "Retrieves value from a key-value memory store, using the key specifed",
      inputSchema: {
        key: z.string().describe("Key to retrieve the value"),
      },
    },
    async ({ key }) => {
      const value = memory.get(key);
      const text = JSON.stringify({ value }) || "Value Not found";
      return {
        content: [{ type: "text", text }],
      };
    }
  );

  server.registerTool(
    "listAll",
    {
      title: "Lists all values",
      description:
        "Lists all currently stored values and their keys in the key-value memory store",
    },
    async () => {
      const values = Object.fromEntries(memory.entries());
      const text = JSON.stringify(values);
      return {
        content: [{ type: "text", text }],
      };
    }
  );

  return server;
}
