/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import {
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
  blank,
} from "@google-labs/breadboard";
import { GraphProviderStore } from "./types";
import { GraphProviderExtendedCapabilities } from "@google-labs/breadboard";

interface GraphDBStore {
  url: string;
  apiKey: string;
}

interface GraphDBStoreList extends idb.DBSchema {
  stores: {
    key: string;
    value: GraphDBStore;
  };
}

const STORE_LIST = "remote-store-list";
const STORE_LIST_VERSION = 1;

const authHeader = (apiKey: string, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Authorization", `Bearer ${apiKey}`);
  return h;
};

export class RemoteGraphProvider implements GraphProvider {
  static #instance: RemoteGraphProvider;
  static instance() {
    if (!this.#instance) {
      this.#instance = new RemoteGraphProvider();
    }
    return this.#instance;
  }

  readonly name = "RemoteGraphProvider";
  title = "Remote";

  #locations: GraphDBStore[] = [];
  #stores: Map<string, GraphProviderStore<void>> = new Map<
    string,
    {
      permission: "unknown" | "prompt" | "granted";
      title: string;
      items: Map<string, { url: string; readonly: boolean; handle: void }>;
    }
  >();

  private constructor() {}

  #getApiKey(location: string) {
    const store = this.#locations.find((store) => store.url === location);
    if (!store) {
      return null;
    }
    return store.apiKey;
  }

  async #sendToRemote(url: URL, descriptor: GraphDescriptor) {
    const apiKey = this.#getApiKey(url.origin);
    if (!apiKey) {
      return { error: "No API Key" };
    }
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(descriptor, null, 2),
      headers: authHeader(apiKey, [["Content-Type", "application/json"]]),
    });
    return await response.json();
  }

  async createURL(location: string, fileName: string) {
    const apiKey = this.#getApiKey(location);
    if (!apiKey) {
      return null;
    }
    const response = await fetch(`${location}/boards`, {
      method: "POST",
      body: JSON.stringify({ name: fileName }),
      headers: authHeader(apiKey),
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return `${location}/boards/${data.path}`;
  }

  parseURL(_url: URL) {
    throw new Error("Not implemented for RemoteGraphProvider");
    return { location: "", fileName: "" };
  }

  async load(url: URL) {
    const response = await fetch(url);
    const graph = await response.json();

    return graph;
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(url, descriptor);
    if (data.error) {
      return { result: false };
    }

    await this.#refreshAllItems();
    return { result: true };
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const location = url.origin;
    const store = this.#locations.find((store) => store.url === location);
    if (!store) {
      return { result: false };
    }

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: authHeader(store.apiKey),
      });
      const data = await response.json();
      await this.#refreshAllItems();

      if (data.error) {
        return { result: false };
      }
      return { result: true };
    } catch (err) {
      return { result: true };
    }
  }

  async connect(location?: string, auth?: unknown) {
    if (!location) {
      return false;
    }
    if (!auth) {
      // TODO: Support public servers. For now, Auth is required.
      return false;
    }
    const apiKey = auth as string;

    const response = await fetch(`${location}/boards`, {
      headers: authHeader(apiKey),
    });
    if (response.ok) {
      for (const storeLocation of this.#locations) {
        if (storeLocation.url === location) {
          return true;
        }
      }

      this.#locations.push({ url: location, apiKey });
      await this.#storeLocations();
      await this.#refreshAllItems();
      return true;
    }

    return false;
  }

  async disconnect(location: string) {
    this.#locations = this.#locations.filter((store) => store.url !== location);
    await this.#storeLocations();
    await this.#refreshAllItems();
    return true;
  }

  async refresh(location: string): Promise<boolean> {
    const store = this.#locations.find((store) => store.url === location);
    if (!store) {
      return false;
    }

    await this.#refreshItems(store);
    return true;
  }

  items() {
    return this.#stores;
  }

  startingURL() {
    return null;
  }

  isSupported(): boolean {
    return true;
  }

  async createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(url, blank());
    if (data.error) {
      return { result: false };
    }

    await this.#refreshAllItems();
    return { result: true };
  }

  async restore() {
    const storeDb = await idb.openDB<GraphDBStoreList>(
      STORE_LIST,
      STORE_LIST_VERSION,
      {
        upgrade(db) {
          if (db.objectStoreNames.contains("stores")) return;
          db.createObjectStore("stores", {
            keyPath: "id",
            autoIncrement: true,
          });
        },
      }
    );

    this.#locations = await storeDb.getAll("stores");
    return this.#refreshAllItems();
  }

  async #storeLocations() {
    const storeDb = await idb.openDB<GraphDBStoreList>(
      STORE_LIST,
      STORE_LIST_VERSION
    );

    await storeDb.clear("stores");
    for (const location of this.#locations) {
      await storeDb.put("stores", location);
    }
  }

  async #refreshItems(store: GraphDBStore) {
    const response = await fetch(`${store.url}/boards`, {
      headers: authHeader(store.apiKey),
    });
    const files = await response.json();

    const items = new Map<
      string,
      { url: string; readonly: boolean; handle: void }
    >();
    for (const item of files) {
      let file: string;
      let readonly: boolean;
      if (typeof item === "string") {
        file = item;
        readonly = false;
      } else {
        file = item.path;
        readonly = item.readonly;
      }
      items.set(file, {
        url: `${store.url}/boards/${file}`,
        readonly,
        handle: void 0,
      });
    }

    this.#stores.set(store.url, {
      permission: "granted",
      title: store.url,
      items,
    });
  }

  async #refreshAllItems() {
    this.#stores.clear();

    for (const store of this.#locations) {
      await this.#refreshItems(store);
    }
  }

  async createGraphURL(location: string, fileName: string) {
    return await this.createURL(location, fileName);
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const store = this.#locations.find((store) =>
      url.href.startsWith(store.url)
    );
    if (store) {
      const storeData = this.#stores.get(store.url);
      const item = storeData?.items.get(url.href);
      if (!item) {
        return {
          load: false,
          save: true,
          delete: false,
        };
      }
      return {
        load: true,
        save: !item.readonly,
        delete: !item.readonly,
      };
    }
    return false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: true,
      connect: true,
      disconnect: true,
      refresh: true,
      watch: false,
    };
  }

  watch() {
    throw new Error("Watch not implemented for RemoteProvider");
  }
}
