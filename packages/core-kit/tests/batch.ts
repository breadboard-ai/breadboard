/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import batcher from "../src/nodes/batch.js";

test("works with reasonable arguments", async (t) => {
  const inputs = {
    list: [1, 2, 3],
    size: 2,
  };
  const outputs = await batcher.invoke(inputs);
  t.deepEqual(outputs, {
    list: [[1, 2], [3]],
  });
});

test("handles unreasonable arguments", async (t) => {
  {
    const inputs = {
      list: [],
      size: 2,
    };
    const outputs = await batcher.invoke(inputs);
    t.deepEqual(outputs, {
      list: [[]],
    });
  }
  {
    const inputs = {
      list: [1, 2],
      size: 0,
    };
    await t.throwsAsync(async () => await batcher.invoke(inputs));
  }
  {
    const inputs = {};
    await t.throwsAsync(async () => await batcher.invoke(inputs));
  }
  {
    const inputs = {
      size: 100,
    };
    await t.throwsAsync(async () => await batcher.invoke(inputs));
  }
});
