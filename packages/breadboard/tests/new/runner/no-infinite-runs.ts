/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { board } from "../../../src/new/grammar/board.js";

import { testKit } from "../../helpers/_test-kit.js";

test("broken graph should return an error", async (t) => {
  const brokenGraph = board<{ foo: string }>(({ foo }) => ({
    bar: testKit.reverser({ foo }).bar, // Note: should be .foo
  }));

  let result;

  try {
    result = await brokenGraph({ foo: "bar" });
  } catch (e) {
    t.is(
      (e as Error).message,
      "Output node never reached. Last node was reverser-3.\n\n" +
        "These nodes had inputs missing:\n" +
        "  output-2: bar"
    );
  }
  t.deepEqual(result, {
    $error: {
      type: "error",
      error: new Error(
        "Output node never reached. Last node was reverser-3.\n\n" +
          "These nodes had inputs missing:\n" +
          "  output-2: bar"
      ),
    },
  });
});
