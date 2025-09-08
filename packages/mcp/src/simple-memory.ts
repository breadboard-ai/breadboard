/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { McpBuiltInServerEntry } from "./types.js";
import { BuiltInClient } from "./built-in-client.js";

export { SimpleMemoryServer };

const memory = new Map<string, string>();

class SimpleMemoryServer implements McpBuiltInServerEntry {
  client: BuiltInClient;

  constructor() {
    this.client = new BuiltInClient({
      name: "Simple Memory",
      url: "builtin:memory",
    });
    this.client.addTool(
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

    this.client.addTool(
      "storeEntries",
      {
        title: "Store multiple key-value pairs",
        description:
          "Stores multiple key-value pairs in key-value memory store",
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

    this.client.addTool(
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

    this.client.addTool(
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
  }

  get info() {
    return this.client.info;
  }
}
