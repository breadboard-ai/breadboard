/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphProviderItem,
  MutableGraphCollection,
} from "@breadboard-ai/types";
import { openDB, type DBSchema, type IDBPObjectStore } from "idb";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import type { GoogleDriveClient } from "../google-drive-client.js";
import { makeGraphListQuery } from "./operations.js";
import { readProperties } from "./utils.js";

const DB_NAME = "graph-cache";
const USER_GRAPHS_STORE_NAME = "user-graphs";
const USER_METADATA_STORE_NAME = "user-metadata";
const DAY_MILLIS = 24 * 60 * 60 * 1000;
const MAX_CACHE_AGE_MILLIS = 7 * DAY_MILLIS;

interface UserGraphsSchema extends DBSchema {
  [USER_GRAPHS_STORE_NAME]: {
    key: GraphProviderItem["url"];
    value: GraphProviderItem;
  };
  [USER_METADATA_STORE_NAME]: {
    key: "lastAuthoritativeSyncMillis";
    value: number;
  };
}

function openIdbGraphCache() {
  return openDB<UserGraphsSchema>(DB_NAME, 1, {
    upgrade: (db) => {
      db.createObjectStore(USER_GRAPHS_STORE_NAME, {
        keyPath: "url" satisfies keyof UserGraphsSchema,
      });
      db.createObjectStore(USER_METADATA_STORE_NAME);
    },
  });
}

export async function clearIdbGraphCache(): Promise<void> {
  const db = await openIdbGraphCache();
  const tx = db.transaction(
    [USER_GRAPHS_STORE_NAME, USER_METADATA_STORE_NAME],
    "readwrite"
  );
  const graphs = tx.objectStore(USER_GRAPHS_STORE_NAME);
  const metadata = tx.objectStore(USER_METADATA_STORE_NAME);
  await Promise.all([graphs.clear(), metadata.clear()]);
  await tx.done;
  db.close();
}

type IdbWriteTask = {
  done: PromiseWithResolvers<void>;
  func: (stores: {
    graphs: IdbWriteTaskStore<typeof USER_GRAPHS_STORE_NAME>;
    metadata: IdbWriteTaskStore<typeof USER_METADATA_STORE_NAME>;
  }) => Promise<unknown>;
};

type IdbWriteTaskStore<
  T extends typeof USER_GRAPHS_STORE_NAME | typeof USER_METADATA_STORE_NAME,
> = IDBPObjectStore<
  UserGraphsSchema,
  Array<typeof USER_GRAPHS_STORE_NAME | typeof USER_METADATA_STORE_NAME>,
  T,
  "readwrite"
>;

export class DriveUserGraphCollection implements MutableGraphCollection {
  readonly #graphs = new SignalMap<string, GraphProviderItem>();

  has(url: string): boolean {
    return this.#graphs.has(url);
  }

  entries(): IterableIterator<[string, GraphProviderItem]> {
    return this.#graphs.entries();
  }

  get size(): number {
    return this.#graphs.size;
  }

  @signal accessor #loading = true;
  get loading(): boolean {
    return this.#loading;
  }

  #loaded = Promise.withResolvers<void>();
  get loaded() {
    return this.#loaded.promise;
  }

  @signal accessor #error: Error | undefined = undefined;
  get error(): Error | undefined {
    return this.#error;
  }

  readonly #drive: GoogleDriveClient;

  readonly #idb = openIdbGraphCache();

  constructor(drive: GoogleDriveClient) {
    this.#drive = drive;
    void this.#initialize();
  }

  #initialized = false;
  readonly #preInitializationMutations: Array<() => void> = [];

  async #initialize() {
    // Start loading the user's authoritative graphs from Drive (slow).
    const driveGraphsPromise = this.#listDriveGraphs();

    // ... Meanwhile, try to load from the local IndexedDB cache (fast).
    const idbGraphs = await this.#listIdbGraphs();
    if (idbGraphs !== undefined) {
      for (const graph of idbGraphs) {
        this.#graphs.set(graph.url, graph);
      }
      // Since we got a cache hit, allow anything watching the loading signal
      // (e.g. the homepage) to do an initial render.
      this.#loading = false;
      this.#loaded.resolve();
    }

    // Authoritative graphs from Drive are here. Syncronize our local and IDB
    // caches to match exactly.
    const driveGraphs = await driveGraphsPromise;
    this.#graphs.clear();
    for (const graph of driveGraphs) {
      this.#graphs.set(graph.url, graph);
    }
    await this.#doSerializedIdbWrite(async ({ graphs, metadata }) => {
      await graphs.clear();
      await Promise.all(driveGraphs.map((graph) => graphs.put(graph)));
      await metadata.put(Date.now(), "lastAuthoritativeSyncMillis");
    });

    // ... But note that we allow the user to add, remove, or edit their graphs
    // *before the Drive request completes* to keep things responsive! If that
    // indeed happened, we now need to replay all such mutations, because
    // otherwise those changes will have been clobbered.
    this.#initialized = true;
    while (this.#preInitializationMutations.length > 0) {
      const func = this.#preInitializationMutations.pop()!;
      func();
    }

    if (this.#loading) {
      this.#loading = false;
      this.#loaded.resolve();
    }
  }

  async #listIdbGraphs(): Promise<GraphProviderItem[] | undefined> {
    const db = await this.#idb;
    const tx = db.transaction(
      [USER_GRAPHS_STORE_NAME, USER_METADATA_STORE_NAME],
      "readonly"
    );
    const metadata = await tx.objectStore(USER_METADATA_STORE_NAME);
    const lastAuthoritativeSyncMillis = await metadata.get(
      "lastAuthoritativeSyncMillis"
    );
    if (
      lastAuthoritativeSyncMillis === undefined ||
      lastAuthoritativeSyncMillis < Date.now() - MAX_CACHE_AGE_MILLIS
    ) {
      return undefined;
    }
    const graphs = tx.objectStore(USER_GRAPHS_STORE_NAME);
    return await graphs.getAll();
  }

  async #listDriveGraphs(): Promise<GraphProviderItem[]> {
    const query = makeGraphListQuery({
      kind: "editable",
      owner: "me",
      parent: undefined,
    });
    let response;
    try {
      response = await this.#drive.listFiles(query, {
        fields: [
          "id",
          "name",
          "modifiedTime",
          "properties",
          "appProperties",
          "isAppAuthorized",
        ],
        orderBy: [{ field: "modifiedTime", dir: "desc" }],
      });
    } catch (e) {
      this.#setError(
        new AggregateError([e], `error while listing user graphs from drive`)
      );
      return [];
    }

    return response.files
      .filter(
        // Filter down to graphs created by whatever the current OAuth app is.
        // Otherwise, graphs from different OAuth apps will appear in this list
        // too, and if they are selected, we won't be able to edit them. Note
        // there is no way to do this in the query itself.
        (file) => file.isAppAuthorized
      )
      .map((file): GraphProviderItem => {
        const url = `drive:/${file.id}`;
        const properties = readProperties(file);
        return {
          url,
          title: file.name,
          description: properties.description,
          thumbnail: properties.thumbnailUrl,
          mine: true,
          readonly: false,
          handle: null,
        };
      });
  }

  /** All IDB mutations are serialized to improve consistency. */
  readonly #idbWriteQueue: IdbWriteTask[] = [];
  #idbWriteQueueIsProcessing = false;

  #doSerializedIdbWrite(func: IdbWriteTask["func"]) {
    const done = Promise.withResolvers<void>();
    this.#idbWriteQueue.push({ done, func });
    void this.#processIdbQueue();
    return done.promise;
  }

  async #processIdbQueue() {
    if (this.#idbWriteQueueIsProcessing) {
      return;
    }
    this.#idbWriteQueueIsProcessing = true;
    const db = await this.#idb;
    while (this.#idbWriteQueue.length > 0) {
      const { func, done } = this.#idbWriteQueue.pop()!;
      const tx = db.transaction(
        [USER_GRAPHS_STORE_NAME, USER_METADATA_STORE_NAME],
        "readwrite"
      );
      try {
        const graphs = tx.objectStore(USER_GRAPHS_STORE_NAME);
        const metadata = tx.objectStore(USER_METADATA_STORE_NAME);
        await func({ graphs, metadata });
        await tx.done;
      } catch (e) {
        tx.abort();
        done.reject(e);
      }
      done.resolve();
    }
    this.#idbWriteQueueIsProcessing = false;
  }

  put(graph: GraphProviderItem): void {
    this.#graphs.set(graph.url, graph);
    if (this.#initialized) {
      this.#doSerializedIdbWrite(({ graphs }) => graphs.put(graph));
    } else {
      this.#preInitializationMutations.push(() => this.put(graph));
    }
  }

  delete(url: string): boolean {
    const existed = this.#graphs.delete(url);
    if (this.#initialized) {
      this.#doSerializedIdbWrite(({ graphs }) => graphs.delete(url));
    } else {
      this.#preInitializationMutations.push(() => this.delete(url));
    }
    return existed;
  }

  #setError(e: Error) {
    console.error(`[user graphs] ${e.message}`, e);
    this.#error = e;
  }
}
