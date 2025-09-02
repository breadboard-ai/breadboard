/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type DataStore,
  createDefaultDataStore,
  PersistentBackend,
  EphemeralBlobStore,
} from "@google-labs/breadboard";
import { IDBBackend } from "./file-system/idb-backend.js";
import { IdbFlagManager } from "./flags/idb-flag-manager.js";
import { RuntimeFlags } from "@breadboard-ai/types";

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
