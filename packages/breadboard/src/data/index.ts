/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SimpleDataStore } from "./simple.js";
import { DataStore } from "./types.js";

export const createDataStore = (): DataStore => {
  return new SimpleDataStore();
};

export { inflateData, deflateData } from "./inflate-deflate.js";

export { isDataCapability, asBlob } from "./common.js";
