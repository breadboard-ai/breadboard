/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { Action, modeRouterFunction } from "../src/boards/human.js";
import { Context } from "../src/context.js";
import { deepStrictEqual } from "node:assert";

describe("human/modeRouterFunction", () => {
  test("correctly recognizes the `input` mode", () => {
    const context: Context[] = [
      {
        role: "user",
        parts: [
          {
            text: "Hello",
          },
        ],
      },
    ];
    const action: Action = { action: "none" };
    const result = modeRouterFunction({ context });
    deepStrictEqual(result, { context, action });
  });
});
