/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from "idb";
import { PrimitiveType, Storage } from "../../../types.js";

export class IdbStorageWrapper implements Storage {
  private dbPromiseCache: Promise<IDBPDatabase> | null = null;

  constructor(
    private readonly storeName = "values",
    private readonly dbName = "app-controller-storage"
  ) {}

  private get dbPromise(): Promise<IDBPDatabase> {
    if (!this.dbPromiseCache) {
      const objectStoreName = this.storeName;
      this.dbPromiseCache = openDB(this.dbName, 1, {
        upgrade(db) {
          // Create the store if it doesn't exist.
          if (!db.objectStoreNames.contains(objectStoreName)) {
            db.createObjectStore(objectStoreName);
          }
        },
      });
    }
    return this.dbPromiseCache;
  }

  async get<T extends PrimitiveType>(name: string): Promise<T | null> {
    const db = await this.dbPromise;
    const val = await db.get(this.storeName, name);
    // IDB returns undefined for missing keys; we normalize to null for the
    // interface definition that we have.
    return val === undefined ? null : (val as T);
  }

  async set<T extends PrimitiveType>(name: string, value: T): Promise<void> {
    const db = await this.dbPromise;
    await db.put(this.storeName, value, name);
  }

  async delete(name: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(this.storeName, name);
  }

  // Not tested because in tests we use the in-memory storage.
  /* c8 ignore next 3 */
  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(this.storeName);
  }
}
