/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "@google-labs/graph-runner";

import { SQLiteCacheManager } from "../cache.js";

export default async (inputs: InputValues): Promise<OutputValues> => {
  // Undefined or empty path means in-memory cache
  const path = (inputs["path"] as string) || ":memory:";
  const cacheManager = new SQLiteCacheManager(path);
  return { cache: cacheManager } as unknown as OutputValues;
};
