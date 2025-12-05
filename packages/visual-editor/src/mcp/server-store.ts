/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { DBSchema, IDBPDatabase, openDB } from "idb";
import { Signal } from "signal-polyfill";
import { McpListToolResult, McpServerInfo, McpServerStore } from "./types.js";
import { err } from "@breadboard-ai/utils";

const MCP_SERVERS_DB = "mcp-servers";

export { createMcpServerStore };

function createMcpServerStore(): McpServerStore {
  return new McpServerStoreImpl();
}

interface McpServerList extends DBSchema {
  servers: {
    /**
     * Key is the URL of the server
     */
    key: string;
    value: Omit<McpServerInfo, "url">;
  };
}

class McpServerStoreImpl implements McpServerStore {
  #db: Promise<IDBPDatabase<McpServerList>>;

  // Makes it work with signals.
  readonly #changed = new Signal.State({});

  constructor() {
    this.#db = this.#initialize();
  }

  async #initialize(): Promise<IDBPDatabase<McpServerList>> {
    return openDB<McpServerList>(MCP_SERVERS_DB, 1, {
      upgrade(db) {
        db.createObjectStore("servers");
      },
    });
  }

  async add(info: McpServerInfo): Promise<Outcome<void>> {
    this.#changed.set({});
    const db = await this.#db;
    const tx = db.transaction("servers", "readwrite");
    const servers = tx.objectStore("servers");
    const { url, ...value } = info;
    servers.put(value, url);
    return tx.done;
  }

  async updateTools(
    url: string,
    tools: McpListToolResult["tools"]
  ): Promise<Outcome<void>> {
    this.#changed.set({});
    const db = await this.#db;
    const tx = db.transaction("servers", "readwrite");
    const servers = tx.objectStore("servers");
    const result = await servers.get(url);
    if (!result) {
      await tx.done;
      return err(`Server "${url}" was not found in the server store`);
    }
    const updated = {
      ...result,
      tools,
      toolsRetrievedOn: new Date(),
    };
    servers.put(updated, url);
  }

  async remove(url: string): Promise<Outcome<void>> {
    this.#changed.set({});
    const db = await this.#db;
    const tx = db.transaction("servers", "readwrite");
    const servers = tx.objectStore("servers");
    servers.delete(url);
    return tx.done;
  }

  async get(url: string): Promise<McpServerInfo | undefined> {
    this.#changed.get();
    const db = await this.#db;
    const tx = db.transaction("servers", "readonly");
    const servers = tx.objectStore("servers");
    const result = await servers.get(url);
    await tx.done;
    if (!result) return;

    return {
      url,
      ...result,
    };
  }

  async list(): Promise<Outcome<McpServerInfo[]>> {
    this.#changed.get();
    const db = await this.#db;
    const tx = db.transaction("servers", "readonly");
    const servers = tx.objectStore("servers");
    const [keys, values] = await Promise.all([
      servers.getAllKeys(),
      servers.getAll(),
    ]);
    await tx.done;
    return values.map((value, index) => ({
      ...value,
      url: keys[index],
    }));
  }
}
