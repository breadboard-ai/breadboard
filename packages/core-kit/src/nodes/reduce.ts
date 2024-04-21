/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeValue,
  OutputValues,
  SchemaBuilder,
} from "@google-labs/breadboard";
import { getRunner } from "../utils.js";

export type ReduceInputs = {
  /**
   * The list to iterate over.
   */
  list: unknown[];

  /**
   * The board to run for each element of the list.
   */
  board?: unknown;

  /**
   * The initial value for the accumulator.
   */
  accumulator?: unknown;
};

export type ReduceOutputs = {
  /**
   * The final value of the accumulator.
   */
  accumulator: unknown;
};

export type ReduceFunctionInputs = {
  /**
   * The current value of the accumulator.
   */
  accumulator: NodeValue;

  /**
   * The current item from the list.
   */
  item: NodeValue;
};

const invoke = async (
  inputs: InputValues,
  context: NodeHandlerContext
): Promise<OutputValues> => {
  const { list, board, accumulator } = inputs;
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
    const { accumulator } = await runnableBoard.runOnce(
      { item, accumulator: result },
      newContext
    );
    result = accumulator;
  }
  return { accumulator: result };
};

const describe = async () => {
  const inputSchema = new SchemaBuilder()
    .addProperty("list", {
      title: "List",
      type: "array",
      description: "The list to iterate over.",
    })
    .addProperty("board", {
      title: "Board",
      type: "object",
      behavior: ["board"],
      description: "The board to run for each element of the list.",
    })
    .addProperty("accumulator", {
      title: "Accumulator",
      type: "object",
      description: "The initial value for the accumulator.",
    })
    .build();
  const outputSchema = new SchemaBuilder()
    .addProperty("accumulator", {
      title: "Accumulator",
      type: "object",
      description: "The final value of the accumulator.",
    })
    .build();
  return { inputSchema, outputSchema };
};

const metadata = {
  title: "Reduce",
  description:
    "Given a list, an initial accumulator value, and a board, invokes a board (runOnce) for each item and accumulator in the list and returns the final accumulator value. Loosely, same logic as the `reduce` function in JavaScript.",
} satisfies NodeHandlerMetadata;

export default { metadata, invoke, describe };
