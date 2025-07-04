/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { hash } from "../../src/hash.js";
import { deepStrictEqual } from "node:assert";

describe("hash", () => {
  test("hashes a string", () => {
    deepStrictEqual(hash("hello"), 181380007);
  });

  test("hashes an object", () => {
    deepStrictEqual(hash({ a: "hello" }), 186885731);
  });

  test("hashes an array", () => {
    deepStrictEqual(hash(["hello"]), 1327990477);
  });

  test("hashes a nested object", () => {
    deepStrictEqual(hash({ a: { b: "hello" } }), 357563268);
  });

  test("hashes a undefined", () => {
    deepStrictEqual(hash(undefined), 3288676927);
  });
});
