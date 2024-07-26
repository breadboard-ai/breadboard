/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RunStore, DataStore } from "@google-labs/breadboard";
import { DefaultDataStore } from "./data/default-store.js";
import { InMemoryRunStore } from "./run/in-memory-store.js";
import { IDBRunStore } from "./run/idb-store.js";

export { toInlineDataPart, toStoredDataPart } from "./run/convert.js";

export function getDefaultDataStore(): DataStore {
  return new DefaultDataStore();
}

export function getRunStore(): RunStore {
  if ("indexedDB" in globalThis) {
    console.log("[Data Store] Using IDB Store");
    return new IDBRunStore();
  }

  console.log("[Data Store] Using In-Memory Store");
  return new InMemoryRunStore();
}
