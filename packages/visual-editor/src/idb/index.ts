/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EphemeralBlobStore,
  PersistentBackend,
  RuntimeFlags,
} from "@breadboard-ai/types";
import { IDBBackend } from "./file-system/idb-backend.js";
import { IdbFlagManager } from "./flags/idb-flag-manager.js";

export function createFileSystemBackend(
  store: EphemeralBlobStore
): PersistentBackend {
  return new IDBBackend(store);
}

export function createFlagManager(env: RuntimeFlags) {
  throw new Error("createFlagManager no longer in use");
  return new IdbFlagManager(env);
}
