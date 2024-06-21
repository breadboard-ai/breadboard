/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import {
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderItem,
  blankLLMContent,
} from "@google-labs/breadboard";
import { GraphProviderStore } from "./types";
import { GraphDescriptor } from "../../../schema/dist/graph";
import { GraphProviderExtendedCapabilities } from "@google-labs/breadboard";

interface GraphDBStore {
  name: string;
  version: number;
  title: string;
}

interface GraphDBStoreList extends idb.DBSchema {
  stores: {
    key: string;
    value: GraphDBStore;
  };
}

interface GraphDB extends idb.DBSchema {
  graphs: {
    key: string;
    value: GraphDescriptor;
  };
}

const STORE_LIST = "store-list";
const STORE_LIST_VERSION = 1;
const IDB_PROTOCOL = "idb:";
const DEFAULT_STORE: GraphDBStore = {
  name: "default",
  version: 1,
  title: "Browser Storage",
};
const PREFIX = IDB_PROTOCOL + "//";

export class IDBGraphProvider implements GraphProvider {
  static #instance: IDBGraphProvider;
  static instance() {
    if (!this.#instance) {
      this.#instance = new IDBGraphProvider();
    }
    return this.#instance;
  }

  #storeLocations: GraphDBStore[] = [];
  #stores: Map<string, GraphProviderStore<void>> = new Map<
    string,
    {
      permission: "unknown" | "prompt" | "granted";
      title: string;
      items: Map<string, GraphProviderItem & { handle: void }>;
    }
  >();

  name = "IDBGraphProvider";

  private constructor() {}

  isSupported() {
    return "IDBOpenDBRequest" in window;
  }

  parseURL(url: URL) {
    if (url.protocol !== IDB_PROTOCOL) {
      throw new Error("Unsupported protocol");
    }
    const pathName = url.href.replace(new RegExp(`^${PREFIX}`, "gim"), "");
    const [location, fileName] = pathName.split("/");
    if (!location || !fileName) {
      throw new Error(
        `Invalid path: ${url.href} ${pathName} ${location} ${fileName}`
      );
    }

    return { location, fileName };
  }

  async createURL(location: string, fileName: string) {
    return `${IDB_PROTOCOL}//${encodeURIComponent(location.toLocaleLowerCase())}/${encodeURIComponent(fileName.toLocaleLowerCase())}`;
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

    let storeList = await storeDb.getAll("stores");
    if (storeList.length === 0) {
      await storeDb.put("stores", DEFAULT_STORE);
      storeList = await storeDb.getAll("stores");
    } else {
      // TODO: Remove this eventually. For now, it's a useful way of updating
      // the title of the default store when it's changed.
      for (const store of storeList) {
        if (
          store.name === DEFAULT_STORE.name &&
          store.title !== DEFAULT_STORE.title
        ) {
          console.warn(
            `Updating "Board Store" title to ${DEFAULT_STORE.title}`
          );
          store.title = DEFAULT_STORE.title;
          await storeDb.put("stores", store);
        }
      }
    }

    this.#storeLocations = storeList;
    return this.#refreshAllItems();
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const canProvide = url.protocol === IDB_PROTOCOL;
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
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
    };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    try {
      const { location } = this.parseURL(url);
      const store = this.#storeLocations.find(
        (boardLocation) => boardLocation.name === location
      );
      if (!store) {
        return null;
      }
      const db = await idb.openDB<GraphDB>(store.name, store.version);
      const graph = (await db.get("graphs", url.href)) || null;
      return graph;
    } catch (err) {
      // Failed to load.
      return null;
    }
  }

  async createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    return this.create(url, blankLLMContent());
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    const existingBoard = await this.load(url);
    if (existingBoard) {
      return { result: false, error: "Unable to create: board already exists" };
    }

    return this.save(url, descriptor);
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    try {
      const { location } = this.parseURL(url);
      const store = this.#storeLocations.find(
        (boardLocation) => boardLocation.name === location
      );
      if (!store) {
        return { result: false, error: "Unable to locate store" };
      }
      const db = await idb.openDB<GraphDB>(store.name, store.version);
      descriptor.url = url.href;
      await db.put("graphs", descriptor);
      await this.#refreshAllItems();
      return { result: true };
    } catch (err) {
      // Failed to save.
      return { result: false, error: (err as unknown as Error).toString() };
    }
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    try {
      const { location } = this.parseURL(url);
      const store = this.#storeLocations.find(
        (boardLocation) => boardLocation.name === location
      );
      if (!store) {
        return { result: false, error: "Unable to locate store" };
      }
      const db = await idb.openDB<GraphDB>(store.name, store.version);
      await db.delete("graphs", url.href);
      await this.#refreshAllItems();
      return { result: true };
    } catch (err) {
      // Failed to delete.
      return { result: false, error: (err as unknown as Error).toString() };
    }
  }

  async connect(_location?: string): Promise<boolean> {
    throw new Error("Connect not implemented for IDBGraphProvider");
  }

  async disconnect(_location: string): Promise<boolean> {
    throw new Error("Disconnect not implemented for IDBGraphProvider");
  }

  async refresh(location: string): Promise<boolean> {
    const store = this.#storeLocations.find(
      (boardLocation) => boardLocation.name === location
    );

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
    return new URL("idb://default/blank.json");
  }

  watch() {
    throw new Error("Watch not implemented for IDBGraphProvider");
  }

  async #refreshItems(store: GraphDBStore) {
    const db = await idb.openDB<GraphDB>(store.name, store.version, {
      upgrade(db) {
        db.createObjectStore("graphs", {
          keyPath: "url",
        });
      },
    });

    let graphs = await db.getAll("graphs");
    if (graphs.length === 0 && store.name === DEFAULT_STORE.name) {
      const blankBoard = blankLLMContent();
      blankBoard.url = await this.createURL(DEFAULT_STORE.name, "blank.json");
      await db.put("graphs", blankBoard);
      graphs = await db.getAll("graphs");
    }

    const itemsByUrl = graphs.map(
      (descriptor): [string, GraphProviderItem & { handle: void }] => {
        const url = descriptor.url || "";
        const { fileName } = this.parseURL(new URL(url));

        return [
          fileName,
          {
            url,
            tags: descriptor.metadata?.tags,
            mine: true,
            readonly: false,
            handle: void 0,
          },
        ];
      }
    );

    const items: Map<
      string,
      { url: string; mine: boolean; readonly: boolean; handle: void }
    > = new Map(itemsByUrl);

    this.#stores.set(store.name, {
      permission: "granted",
      title: store.title,
      items,
    });
  }

  async #refreshAllItems() {
    this.#stores.clear();

    for (const store of this.#storeLocations) {
      await this.#refreshItems(store);
    }
  }
}
