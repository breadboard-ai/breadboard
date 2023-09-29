/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "./board.js";
import {
  LambdaFunction,
  ConfigOrLambda,
  BreadboardCapability,
  OptionalIdConfiguration,
} from "./types.js";
import { Node } from "./node.js";
import { InputValues, OutputValues } from "@google-labs/graph-runner";

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

/**
 * Synctactic sugar for node factories that accept lambdas. This allows passing
 * either
 *  - A JS function that is a lambda function defining the board
 *  - A board capability, i.e. the result of calling lambda()
 *  - A board node, which should be a node with a `board` output
 * or
 *  - A regular config, with a `board` property with any of the above.
 *
 * @param config {ConfigOrLambda} the overloaded config
 * @returns {NodeConfigurationConstructor} config with a board property
 */
export const getConfigWithLambda = <In = InputValues, Out = OutputValues>(
  config: ConfigOrLambda<In, Out>
): OptionalIdConfiguration => {
  // Look for functions, nodes and board capabilities.
  const gotBoard =
    typeof config === "function" ||
    config instanceof Node ||
    ((config as BreadboardCapability).kind === "board" &&
      (config as BreadboardCapability).board);

  const result = (
    gotBoard ? { board: config } : config
  ) as OptionalIdConfiguration;

  // Convert passed JS function into a board capability.
  if (typeof result.board === "function")
    result.board = lambda(result.board as LambdaFunction<In, Out>);

  return result;
};
