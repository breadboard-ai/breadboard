/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDefaultDataStore } from "@breadboard-ai/data";
import { RuntimeFlags } from "@breadboard-ai/types";
import {
  type DataStore,
  EphemeralBlobStore,
  PersistentBackend,
} from "@google-labs/breadboard";
import { IDBBackend } from "./file-system/idb-backend.js";
import { IdbFlagManager } from "./flags/idb-flag-manager.js";

// TODO: Allow for other data stores.
export function getDataStore(): DataStore {
  return createDefaultDataStore();
}

export function createFileSystemBackend(
  store: EphemeralBlobStore
): PersistentBackend {
  return new IDBBackend(store);
}

export function createFlagManager(env: RuntimeFlags) {
  return new IdbFlagManager(env);
}
