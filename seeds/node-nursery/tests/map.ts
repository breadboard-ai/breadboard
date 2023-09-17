/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import map, { MapInputs } from "../src/nodes/map.js";

test("map with no graph just outputs list", async (t) => {
  const inputs = {
    list: [1, 2, 3],
  } as MapInputs;
  const outputs = await map(inputs);
  t.deepEqual(outputs, { list: [1, 2, 3] });
});
