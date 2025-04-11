/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DefaultDataStore } from "./default-data-store.js";
import { DefaultRunStore } from "./default-run-store.js";
import { DataStore, RunStore } from "./types.js";

export const createDefaultDataStore = (): DataStore => {
  return new DefaultDataStore();
};

export const createDefaultRunStore = (): RunStore => {
  return new DefaultRunStore();
};

export {
  deflateData,
  inflateData,
  transformContents,
} from "./inflate-deflate.js";

export {
  asBase64,
  asBlob,
  convertStoredPartsToAbsoluteUrls,
  isDataCapability,
  isFileDataCapabilityPart,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isImageURL,
  isInlineData,
  isJSONPart,
  isListPart,
  isLLMContent,
  isLLMContentArray,
  isMetadataEntry,
  isSerializedData,
  isStoredData,
  isTextCapabilityPart,
  toInlineDataPart,
  toStoredDataPart,
  transformDataParts,
} from "./common.js";

export { transformBlobs } from "./file-system/blob-transform.js";
export { createEphemeralBlobStore } from "./file-system/ephemeral-blob-store.js";
export {
  createFileSystem,
  Path,
  writablePathFromString,
} from "./file-system/index.js";

export {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "./file-system/assets.js";

export { StubFileSystem } from "./file-system/stub-file-system.js";
