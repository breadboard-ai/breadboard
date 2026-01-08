/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { LayoutStore } from "../../src/controller/subcontrollers/layout.js";
import { hydrated } from "../helpers/hydrated.js";

suite("LayoutStore", () => {
  test("Basics", async () => {
    const store = new LayoutStore();
    await hydrated([
      () => store.min,
      () => store.max,
      () => store.split
    ]);

    store.setSplit(0);
    assert.strictEqual(store.split, 0.1);
  });

  test("Min & Max errors", async () => {
    const store = new LayoutStore();
    await hydrated([
      () => store.min,
      () => store.max,
      () => store.split
    ]);

    assert.throws(() => {
      store.setMinMax(3);
    }, new Error('Min out of bounds'))

    assert.throws(() => {
      store.setMinMax(0.1, 5);
    }, new Error('Max out of bounds'))

    assert.throws(() => {
      store.setMinMax(0.5, 0.3);
    }, new Error('Min greater than max'))
  });
});
