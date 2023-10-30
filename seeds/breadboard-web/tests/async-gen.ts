/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, test } from "vitest";
import { asyncGen } from "../src/async-gen";

test("async-gen", async () => {
  const results = [];

  async function* foo() {
    yield 1;
    yield* asyncGen(async (next) => {
      results.push(1.5);
      await next(2);
      results.push(2.5);
      await next(3);
      results.push(3.5);
    });
    yield 4;
  }

  for await (const val of foo()) {
    results.push(val);
  }

  expect(results).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4]);
});
