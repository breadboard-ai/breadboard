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
  IDBObjectStore
} from "fake-indexeddb";
import { LocalStorage } from "node-localstorage";

// Assign the factory and keyrange
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;

// Assign the constructors for 'instanceof' checks in the 'idb' library
global.IDBRequest = IDBRequest;
global.IDBDatabase = IDBDatabase;
global.IDBTransaction = IDBTransaction;
global.IDBCursor = IDBCursor;
global.IDBIndex = IDBIndex;
global.IDBObjectStore = IDBObjectStore;

// Add Storage mocks
global.localStorage = new LocalStorage('./storage/local-storage');
global.sessionStorage = new LocalStorage('./storage/session-storage');

global.localStorage.clear();
global.sessionStorage.clear();
