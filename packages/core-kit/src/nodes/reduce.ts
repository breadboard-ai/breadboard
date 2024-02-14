/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  BreadboardCapability,
  InputValues,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";

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

export default async (
  inputs: InputValues,
  context?: NodeHandlerContext
): Promise<OutputValues> => {
  const { list, board, accumulator } = inputs;
  if (!Array.isArray(list)) {
    throw new Error(`Expected list to be an array, but got ${list}`);
  }
  if (!board) return { accumulator };
  const runnableBoard = await Board.fromBreadboardCapability(
    board as BreadboardCapability
  );
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
