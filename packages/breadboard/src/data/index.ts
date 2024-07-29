/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultRunStore } from "./default-run-store.js";
import { DefaultDataStore } from "./default-data-store.js";
import { DataStore, RunStore } from "./types.js";

export const createDefaultDataStore = (): DataStore => {
  return new DefaultDataStore();
};

export const createDefaultRunStore = (): RunStore => {
  return new DefaultRunStore();
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
  toInlineDataPart,
  toStoredDataPart,
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
