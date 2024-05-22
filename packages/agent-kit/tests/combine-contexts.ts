/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { LlmContent, combineContextsFunction } from "../src/context.js";
import { deepStrictEqual } from "node:assert";

describe("combineContexts", () => {
  test("merges contexts when asked", () => {
    const a1 = { text: "Before" };
    const a2 = { text: "Hello" };
    const b1 = { text: "In a" };
    const b2 = { text: "world" };
    const result = combineContextsFunction({
      contextA: [
        {
          parts: [a1],
        },
        {
          parts: [a2],
        },
      ] satisfies LlmContent[],
      contextB: [
        {
          parts: [b1],
        },
        {
          parts: [b2],
        },
      ] satisfies LlmContent[],
      merge: true,
    });

    deepStrictEqual(result, {
      context: [{ parts: [a2, b2] }],
    });
  });
});
