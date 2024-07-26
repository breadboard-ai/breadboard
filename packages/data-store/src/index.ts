/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DataStore } from "@google-labs/breadboard";
import { InMemoryStore } from "./in-memory-store.js";

export function getDataStore(): DataStore {
  return new InMemoryStore();
}
