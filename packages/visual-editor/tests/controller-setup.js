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

globalThis.window ??= {};

// Mock setInterval to prevent module-level intervals from causing test hangs
// This uses a tracked interval approach similar to eval's autoClearingInterval
const activeIntervals = new Set();
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

globalThis.setInterval = (callback, delay, ...args) => {
  const intervalId = originalSetInterval(callback, delay, ...args);
  activeIntervals.add(intervalId);
  // Unref so node doesn't wait for these intervals
  if (intervalId.unref) {
    intervalId.unref();
  }
  return intervalId;
};

globalThis.clearInterval = (intervalId) => {
  activeIntervals.delete(intervalId);
  return originalClearInterval(intervalId);
};

// Clear all tracked intervals on process exit
process.on("beforeExit", () => {
  for (const intervalId of activeIntervals) {
    originalClearInterval(intervalId);
  }
  activeIntervals.clear();
});

if (!globalThis.window.trustedTypes) {
  globalThis.window.trustedTypes = {
    createPolicy(_name, rules) {
      return rules;
    },
  };
}
