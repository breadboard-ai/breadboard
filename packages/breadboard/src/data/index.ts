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
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isLLMContent,
  isTextCapabilityPart,
  isDataCapability,
  isInlineData,
  isStoredData,
  isSerializedData,
  asBlob,
  asBase64,
} from "./common.js";

export type {
  DataStore,
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  LLMContent,
  TextCapabilityPart,
  StoredDataCapabilityPart,
  InlineDataCapabilityPart,
} from "./types.js";
