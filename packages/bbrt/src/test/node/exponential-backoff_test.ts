/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { exponentialBackoff } from "../../util/exponential-backoff.js";

suite("exponentialBackoff", () => {
  test("respects budget", () => {
    const params = {
      budget: 8,
      minDelay: 1,
      maxDelay: 16,
      multiplier: 2,
      jitter: 0,
    };
    assert.deepEqual([...exponentialBackoff(params)], [1, 2, 4, 8]);
  });

  test("respects minDelay", () => {
    const params = {
      budget: 8,
      minDelay: 1.5,
      maxDelay: 16,
      multiplier: 2,
      jitter: 0,
    };
    assert.deepEqual([...exponentialBackoff(params)], [1.5, 3, 6]);
  });

  test("respects maxDelay", () => {
    const params = {
      budget: 8,
      minDelay: 1,
      maxDelay: 3,
      multiplier: 2,
      jitter: 0,
    };
    assert.deepEqual([...exponentialBackoff(params)], [1, 2, 3, 3]);
  });

  test("respects multipler", () => {
    const params = {
      budget: 8,
      minDelay: 1,
      maxDelay: 16,
      multiplier: 1.5,
      jitter: 0,
    };
    assert.deepEqual([...exponentialBackoff(params)], [1, 1.5, 2.25, 3.375]);
  });

  test("respects jitter", () => {
    const params = {
      budget: 8,
      minDelay: 1,
      maxDelay: 16,
      multiplier: 2,
      jitter: 0.0625,
    };
    const expectedRounded = [1, 2, 4, 8];
    const uniqueValues = new Set();
    for (let i = 0; i < 100; i++) {
      const sequence = [...exponentialBackoff(params)];
      assert.deepEqual(
        sequence.map((value) => Math.round(value)),
        expectedRounded
      );
      sequence.forEach((value) => uniqueValues.add(value));
    }
    // This could only fail if we were generating the same sequence every time
    // (and hence not applying jitter).
    assert.ok(uniqueValues.size > expectedRounded.length);
  });
});
