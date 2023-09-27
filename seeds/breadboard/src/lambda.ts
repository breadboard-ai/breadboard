/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "./board.js";
import {
  BreadboardNode,
  BreadboardCapability,
  OptionalIdConfiguration,
} from "./types.js";
import {
  Capability,
  InputValues,
  OutputValues,
} from "@google-labs/graph-runner";

export type LambdaInputs = InputValues & {
  /**
   * The (lambda) board this node represents. The purpose of the this node is to
   * allow wiring data into the lambda board, outside of where it's called.
   * This is useful when passing a lambda to a map node or as a slot.
   *
   * Note that (for now) each board can only be represented by one node.
   */
  board: Capability;

  /**
   * All other inputs will be bound to the board.
   */
};

export type LambdaOutputs = OutputValues & {
  /**
   * The lambda board that can be run.
   */
  board: Capability;
};

/*
// TODO: This likely lives elsewhere, in breadboard perhaps?
export type RunnableBoard = GraphDescriptor & {
  // TODO: Match Board.runOnce and Board.inputs
  runOnce: (inputs: InputValues) => Promise<OutputValues>;
  inputs: InputValues;
  url?: string;
};*/

export type LamdbdaFunction<In, Out> = (
  board: Board,
  input: BreadboardNode<In, Out>,
  output: BreadboardNode<In, Out>
) => void;

export type LambdaResult = OptionalIdConfiguration & {
  board: BreadboardCapability;
};

/**
 * Build a lambda board from a Javascript function. It gets passed a board, and
 * for convenience, input and output nodes attached to the board.
 *
 * Example: board = lambda((board, input, output) => { input.wire( "item->item",
 * kit.someNode().wire( "value->value", output));
 * });
 *
 * @param fun Function that builds the board
 * @param config Optional configuration, e.g. for `$id`
 * @returns { board: BoardCapability } InputValues including the resulting
 *   BoardCapability representing the created board.
 */
export const lambda = <In = InputValues, Out = OutputValues>(
  fun: LamdbdaFunction<In, Out>,
  config: OptionalIdConfiguration = {}
): LambdaResult => {
  const board = new Board();
  const input = board.input<In>();
  const output = board.output<Out>();
  fun(board, input, output);
  return {
    board: {
      kind: "board",
      board,
    } as BreadboardCapability, // TODO: Fix types.
    ...config,
  };
};
