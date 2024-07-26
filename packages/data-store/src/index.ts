/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DataStore } from "@google-labs/breadboard";
import { DefaultDataStore } from "./data/default-store.js";

export function getDefaultDataStore(): DataStore {
  return new DefaultDataStore();
}

export { IDBRunStore } from "./run/idb-store.js";
export { InMemoryRunStore } from "./run/in-memory-store.js";
export { toInlineDataPart, toStoredDataPart } from "./run/convert.js";
