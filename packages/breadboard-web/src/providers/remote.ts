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
}

interface GraphDBStoreList extends idb.DBSchema {
  stores: {
    key: string;
    value: GraphDBStore;
  };
}

const STORE_LIST = "remote-store-list";
const STORE_LIST_VERSION = 1;

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
      items: Map<string, { url: string; handle: void }>;
    }
  >();

  private constructor() {}

  async #sendToRemote(url: URL, descriptor: GraphDescriptor) {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(descriptor, null, 2),
      headers: new Headers([["Content-Type", "application/json"]]),
    });
    return await response.json();
  }

  createURL(location: string, fileName: string) {
    return `${location}/boards/${fileName}`;
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

    try {
      const response = await fetch(url, { method: "DELETE" });
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

  async connect(location?: string) {
    if (!location) {
      return false;
    }

    const response = await fetch(`${location}/boards`);
    if (response.ok) {
      for (const storeLocation of this.#locations) {
        if (storeLocation.url === location) {
          return true;
        }
      }

      this.#locations.push({ url: location });
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
    const response = await fetch(`${store.url}/boards`);
    const files = await response.json();

    const items = new Map<string, { url: string; handle: void }>();
    for (const file of files) {
      items.set(file, {
        url: `${store.url}/boards/${file}`,
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

  createGraphURL(location: string, fileName: string) {
    return this.createURL(location, fileName);
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const canProvide =
      this.#locations.find((store) => url.href.startsWith(store.url)) !==
      undefined;
    return canProvide
      ? {
          load: canProvide,
          save: canProvide,
          delete: canProvide,
        }
      : false;
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
