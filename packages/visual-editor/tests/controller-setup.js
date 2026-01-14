/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  indexedDB,
  IDBKeyRange,
  IDBRequest,
  IDBDatabase,
  IDBTransaction,
  IDBCursor,
  IDBIndex,
  IDBObjectStore,
} from "fake-indexeddb";
import { LocalStorage } from "node-localstorage";

// Assign the factory and keyrange
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Assign the constructors for 'instanceof' checks in the 'idb' library
globalThis.IDBRequest = IDBRequest;
globalThis.IDBDatabase = IDBDatabase;
globalThis.IDBTransaction = IDBTransaction;
globalThis.IDBCursor = IDBCursor;
globalThis.IDBIndex = IDBIndex;
globalThis.IDBObjectStore = IDBObjectStore;

// Add Storage mocks
globalThis.localStorage = new LocalStorage("./test-storage/local-storage");
globalThis.sessionStorage = new LocalStorage("./test-storage/session-storage");
