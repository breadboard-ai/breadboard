/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { getDataStore } from "../src/index.js";

test("getStore can find a store", async (t) => {
  const store = getDataStore();
  t.truthy(store, "Unable to find store");
});
