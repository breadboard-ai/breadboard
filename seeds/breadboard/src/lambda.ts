/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "./board.js";
import { BreadboardNode, BreadboardCapability } from "./types.js";
import { InputValues, OutputValues } from "@google-labs/graph-runner";

export type LambdaFunction<In = InputValues, Out = OutputValues> = (
  board: Board,
  input: BreadboardNode<In, Out>,
  output: BreadboardNode<In, Out>
) => void;

/**
 * Build a lambda board from a Javascript function. It gets passed a board, and
 * for convenience, input and output nodes attached to the board.
 *
 * Example: board = lambda((board, input, output) => { input.wire( "item->item",
 * kit.someNode().wire( "value->value", output));
 * });
 *
 * @param fun Function that builds the board
 * @returns { board: BoardCapability } InputValues including the resulting
 *   BoardCapability representing the created board.
 */
export const lambda = <In = InputValues, Out = OutputValues>(
  fun: LambdaFunction<In, Out>
): BreadboardCapability => {
  const board = new Board();
  const input = board.input<In>();
  const output = board.output<Out>();
  fun(board, input, output);
  return { kind: "board", board } as BreadboardCapability;
};
