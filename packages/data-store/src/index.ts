/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type RunStore,
  type DataStore,
  createDefaultDataStore,
  createDefaultRunStore,
  PersistentBackend,
  EphemeralBlobStore,
} from "@google-labs/breadboard";
import { IDBRunStore } from "./run/idb-run-store.js";
import { IDBBackend } from "./file-system/idb-backend.js";

// TODO: Allow for other data stores.
export function getDataStore(): DataStore {
  return createDefaultDataStore();
}

export function createFileSystemBackend(
  url: string,
  store: EphemeralBlobStore
): PersistentBackend {
  return new IDBBackend(url, store);
}

export function getRunStore(useInMemoryStore = true): RunStore {
  if (useInMemoryStore) {
    console.log("[Breadboard Run Store] Using In-Memory Store");
    return createDefaultRunStore();
  }

  if ("indexedDB" in globalThis) {
    console.log("[Breadboard Run Store] Using IDB Store");
    return new IDBRunStore();
  }

  console.log("[Breadboard Run Store] Using In-Memory Store");
  return createDefaultRunStore();
}
