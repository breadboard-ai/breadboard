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
  isImageURL,
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
  isDataCapability,
  isInlineData,
  isStoredData,
  isSerializedData,
  isMetadataEntry,
  asBlob,
  asBase64,
  toInlineDataPart,
  toStoredDataPart,
} from "./common.js";

export { transformBlobs } from "./file-system/blob-transform.js";
export { createEphemeralBlobStore } from "./file-system/ephemeral-blob-store.js";
export { createFileSystem } from "./file-system/index.js";

export { assetsFromGraphDescriptor } from "./file-system/assets.js";
