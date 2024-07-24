/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultDataStore } from "./default-store.js";
import { DataStore } from "./types.js";

export const createDefaultDataStore = (): DataStore => {
  return new DefaultDataStore();
};
export { inflateData, deflateData } from "./inflate-deflate.js";

export {
  isDataCapability,
  isInlineData,
  isStoredData,
  isSerializedData,
  asBlob,
  asBase64,
} from "./common.js";

export { type DataStore } from "./types.js";
