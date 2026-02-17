/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { getElasticProgress } from "../../../src/sca/utils/elastic-progress.js";

suite("getElasticProgress", () => {
  test("returns 0 for 0 fraction", () => {
    assert.strictEqual(getElasticProgress(0), 0);
  });

  test("is linear before knee", () => {
    assert.strictEqual(getElasticProgress(0.5), 0.5);
  });

  test("equals knee at knee point", () => {
    assert.strictEqual(getElasticProgress(0.75), 0.75);
  });

  test("is greater than knee after knee but less than 1", () => {
    const result = getElasticProgress(0.9);
    assert.ok(result > 0.75, `Expected > 0.75, got ${result}`);
    assert.ok(result < 1, `Expected < 1, got ${result}`);
  });

  test("is well above knee but below 1 for moderate over-knee values", () => {
    const result = getElasticProgress(1.5);
    assert.ok(result < 1, `Expected < 1, got ${result}`);
    assert.ok(result > 0.9, `Expected > 0.9, got ${result}`);
  });

  test("respects custom knee parameter", () => {
    const knee = 0.5;
    assert.strictEqual(getElasticProgress(0.5, knee), 0.5);
    const afterKnee = getElasticProgress(0.6, knee);
    assert.ok(afterKnee > 0.5);
    assert.ok(afterKnee < 1);
  });

  test("respects custom stretch parameter", () => {
    const highStretch = getElasticProgress(1.0, 0.75, 10);
    const lowStretch = getElasticProgress(1.0, 0.75, 1);
    assert.ok(
      highStretch > lowStretch,
      `highStretch (${highStretch}) should > lowStretch (${lowStretch})`
    );
  });

  test("is monotonically increasing", () => {
    let prev = 0;
    for (let i = 0; i <= 20; i++) {
      const fraction = i / 10;
      const result = getElasticProgress(fraction);
      assert.ok(
        result >= prev,
        `Not monotonic at ${fraction}: ${result} < ${prev}`
      );
      prev = result;
    }
  });
});
