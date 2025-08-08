/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { DBSchema, IDBPDatabase, openDB } from "idb";

const MCP_SERVERS_DB = "mcp-servers";

export { McpServerStore };

export type ServerInfo = {
  url: string;
  title: string;
  description?: string;
  icon?: string;
};

interface McpServerList extends DBSchema {
  servers: {
    /**
     * Key is the URL of the server
     */
    key: string;
    value: Omit<ServerInfo, "url">;
  };
}

class McpServerStore {
  #db: Promise<IDBPDatabase<McpServerList>>;

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

  async add(info: ServerInfo): Promise<Outcome<void>> {
    const db = await this.#db;
    const tx = db.transaction("servers", "readwrite");
    const servers = tx.objectStore("servers");
    const { url, ...value } = info;
    servers.put(value, url);
    return tx.done;
  }

  async remove(url: string): Promise<Outcome<void>> {
    const db = await this.#db;
    const tx = db.transaction("servers", "readwrite");
    const servers = tx.objectStore("servers");
    servers.delete(url);
    return tx.done;
  }

  async list(): Promise<Outcome<ServerInfo[]>> {
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
