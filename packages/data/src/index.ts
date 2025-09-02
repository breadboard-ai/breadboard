/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DataStore } from "@breadboard-ai/types";
import { DefaultDataStore } from "./default-data-store.js";

export const createDefaultDataStore = (): DataStore => {
  return new DefaultDataStore();
};

export {
  deflateData,
  inflateData,
  purgeStoredDataInMemoryValues,
  transformContents,
  visitGraphNodes,
  remapData,
} from "./inflate-deflate.js";

export * from "./common.js";

export { inlineAllContent } from "./inline-all-content.js";
export {
  saveOutputsAsFile,
  extensionFromMimeType,
} from "./save-outputs-as-file.js";
