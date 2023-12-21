/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { recipe } from "../../../src/new/recipe-grammar/recipe.js";

import { testKit } from "../../helpers/_test-kit.js";

test("broken graph should return an error", async (t) => {
  const brokenGraph = recipe<{ foo: string }>(({ foo }) => ({
    bar: testKit.reverser({ foo }).bar, // Note: should be .foo
  }));

  let result;

  try {
    result = await brokenGraph({ foo: "bar" });
  } catch (e) {
    t.is(
      (e as Error).message,
      "Output node never reach. Last node was reverser-3.\n\n" +
        "These nodes had inputs missing:\n" +
        "  output-2: bar"
    );
  }
  t.deepEqual(result, {
    $error: {
      type: "error",
      error: new Error(
        "Output node never reach. Last node was reverser-3.\n\n" +
          "These nodes had inputs missing:\n" +
          "  output-2: bar"
      ),
    },
  });
});
