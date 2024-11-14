/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, defineNodeType, object } from "@breadboard-ai/build";
import { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import { invokeGraph } from "@google-labs/breadboard";
import { getRunner } from "../utils.js";

export default defineNodeType({
  name: "reduce",
  metadata: {
    title: "Reduce",
    description:
      "Given a list, an initial accumulator value, and a board, invokes a board (runOnce) for each item and accumulator in the list and returns the final accumulator value. Loosely, same logic as the `reduce` function in JavaScript.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-reduce-component",
    },
  },
  inputs: {
    list: {
      title: "List",
      type: array("unknown"),
      description: "The list to iterate over.",
    },
    board: {
      title: "Board",
      type: object({}, "unknown"),
      behavior: ["board"],
      description: "The board to run for each element of the list.",
    },
    accumulator: {
      title: "Accumulator",
      type: "unknown",
      description: "The initial value for the accumulator.",
    },
  },
  outputs: {
    accumulator: {
      title: "Accumulator",
      type: "unknown",
      description: "The final value of the accumulator.",
    },
  },
  invoke: async ({ list, board, accumulator }, _, context) => {
    if (!Array.isArray(list)) {
      throw new Error(`Expected list to be an array, but got ${list}`);
    }
    const runnableBoard = await getRunner(board, context);
    if (!runnableBoard) return { accumulator };
    let result = accumulator;
    let index = 0;
    for (const item of list) {
      const newContext = {
        ...context,
        invocationPath: [...(context?.invocationPath || []), index++],
      };
      const { accumulator } = await invokeGraph(
        { graph: runnableBoard },
        { item, accumulator: result },
        newContext
      );
      result = accumulator as JsonSerializable;
    }
    return { accumulator: result };
  },
});
