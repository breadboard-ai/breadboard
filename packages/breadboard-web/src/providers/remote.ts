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
  GraphProviderItem,
  blankLLMContent,
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

interface RemoteFileListing {
  mine: boolean;
  path: string;
  readonly: boolean;
  username?: string;
  title?: string;
  tags?: string[];
}

const STORE_LIST = "remote-store-list";
const STORE_LIST_VERSION = 1;

/**
 * For now, make a flag that controls whether to use simple requests or not.
 * Simple requests use "API_KEY" query parameter for authentication.
 */
const USE_SIMPLE_REQUESTS = true;

const CONTENT_TYPE = { "Content-Type": "application/json" };

const authHeader = (apiKey: string, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Authorization", `Bearer ${apiKey}`);
  return h;
};

const createRequest = (
  url: URL | string,
  apiKey: string | null,
  method: string,
  body?: unknown
) => {
  if (typeof url === "string") {
    url = new URL(url, window.location.href);
  }
  if (USE_SIMPLE_REQUESTS) {
    if (apiKey) {
      url.searchParams.set("API_KEY", apiKey);
    }
    return new Request(url.href, {
      method,
      credentials: "include",
      body: JSON.stringify(body),
    });
  }

  return new Request(url, {
    method,
    credentials: "include",
    headers: apiKey ? authHeader(apiKey, CONTENT_TYPE) : CONTENT_TYPE,
    body: JSON.stringify(body),
  });
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
      items: Map<string, GraphProviderItem & { handle: void }>;
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
    const request = createRequest(url, apiKey, "POST", descriptor);
    const response = await fetch(request);
    return await response.json();
  }

  async createURL(location: string, fileName: string) {
    const apiKey = this.#getApiKey(location);
    if (!apiKey) {
      return null;
    }
    const request = createRequest(`${location}/boards`, apiKey, "POST", {
      name: fileName,
    });
    const response = await fetch(request);
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
    const request = createRequest(url, null, "GET");
    const response = await fetch(request);
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
      const request = createRequest(url, store.apiKey, "POST", {
        delete: true,
      });
      const response = await fetch(request);
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

    const request = createRequest(`${location}/boards`, apiKey, "GET");
    const response = await fetch(request);
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
    return this.create(url, blankLLMContent());
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(new URL(url), descriptor);
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
    try {
      const request = createRequest(`${store.url}/boards`, store.apiKey, "GET");
      const response = await fetch(request);
      const files: RemoteFileListing[] = await response.json();

      const items = new Map<string, GraphProviderItem & { handle: void }>();
      for (const item of files) {
        let file: string;
        let readonly: boolean;
        let mine: boolean;
        let tags: string[] | undefined;
        let username: string | undefined;
        let title: string | undefined;
        if (typeof item === "string") {
          file = item;
          readonly = false;
          mine = false;
        } else {
          file = item.path;
          readonly = item.readonly;
          mine = item.mine;
          tags = item.tags;
          username = item.username;
          title = item.title;
        }
        items.set(file, {
          url: `${store.url}/boards/${file}`,
          readonly,
          mine,
          username,
          title,
          tags,
          handle: void 0,
        });
      }

      this.#stores.set(store.url, {
        permission: "granted",
        title: store.url,
        items,
      });
    } catch (err) {
      console.warn(
        `[RemoteGraphProvider]: Unable to connect to ${store.url}`,
        err
      );
    }
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
      const itemName = url.pathname.replace(/^\/boards\//, "");
      const item = storeData?.items.get(itemName);

      if (item) {
        return {
          load: true,
          save: !item.readonly,
          delete: !item.readonly,
        };
      }

      return {
        load: false,
        save: true,
        delete: false,
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
