/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DataStore, RunStore } from "@breadboard-ai/types";
import { DefaultDataStore } from "./default-data-store.js";
import { DefaultRunStore } from "./default-run-store.js";

export const createDefaultDataStore = (): DataStore => {
  return new DefaultDataStore();
};

export const createDefaultRunStore = (): RunStore => {
  return new DefaultRunStore();
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
