/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { SplitterController } from "../../../../../src/sca/controller/subcontrollers/editor/splitter/splitter-controller.js";
import { Rect } from "../../stubs/rect.js";

suite("SplitterController", () => {
  test("Basics", async () => {
    const store = new SplitterController("Editor_1");
    await store.isHydrated;

    store.setSplit(0.65);
    await store.isSettled;
    assert.strictEqual(store.split, 0.65);

    store.setSplit(0.05);
    await store.isSettled;
    assert.strictEqual(store.split, store.min);

    store.setSplit(0.95);
    await store.isSettled;
    assert.strictEqual(store.split, store.max);
  });

  test("Clamped values", async () => {
    const store = new SplitterController("Editor_2");
    await store.isHydrated;

    // 500px, 500px split - should be unclamped.
    const unclamped = store.getClampedValues(0.5, new Rect(0, 0, 1000, 1000));
    assert.deepStrictEqual(unclamped, [0.5, 0.5]);

    // 450px, 50px split - should be clamped.
    const clampedRight = store.getClampedValues(0.9, new Rect(0, 0, 500, 1000));
    const [, right] = clampedRight;
    assert.deepStrictEqual(Math.round(right * 500), store.minRightPixelWidth);

    // 50px, 450px split - should be clamped.
    const clampedLeft = store.getClampedValues(0.1, new Rect(0, 0, 500, 1000));
    const [left] = clampedLeft;
    assert.deepStrictEqual(Math.round(left * 500), store.minLeftPixelWidth);
  });
});
