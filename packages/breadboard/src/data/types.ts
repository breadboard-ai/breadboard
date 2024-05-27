/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataStoreHandle, InlineDataCapabilityPart } from "../types.js";

export type StoredData = {
  asInline(): Promise<InlineDataCapabilityPart>;
};

/**
 * A provider that handles storing and retrieving data.
 */
export type DataStoreProvider = {
  store(data: InlineDataCapabilityPart): Promise<StoredData>;
  retrieve(handle: DataStoreHandle): Promise<StoredData>;
  release(handle: DataStoreHandle): Promise<void>;
  releaseAll(): Promise<void>;
};
