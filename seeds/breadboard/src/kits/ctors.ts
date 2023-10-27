/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Breadboard,
  BreadboardCapability,
  ConfigOrLambda,
  GraphDescriptor,
  InputValues,
  Kit,
  KitConstructor,
  LambdaFunction,
  NodeFactory,
  OptionalIdConfiguration,
  OutputValues,
} from "../types.js";
import { Node } from "../node.js";

/**
 * Takes a kit constructor and creates a kit instance that can be used at
 * run-time.
 *
 * @param ctor Kit constructor
 * @returns A kit instance prepare for run-time use.
 */
export const asRuntimeKit = (ctor: KitConstructor<Kit>) => {
  return new ctor({
    create: () => {
      throw Error("Node instantiation can't (yet) happen during runtime");
    },
  } as unknown as NodeFactory);
};

/**
 * Takes a kit constructor and creates a kit instance that can be used at
 * compose-time (wiring the graph).
 * @param ctor Kit constructor
 * @param board The board with which the kit is associated.
 * @returns Kit instance prepared for compose-time use.
 */
export const asComposeTimeKit = (
  ctor: KitConstructor<Kit>,
  board: Breadboard
): Kit => {
  return new ctor({
    create: (...args) => {
      return new Node(board, ...args);
    },
    getConfigWithLambda: <Inputs, Outputs>(
      config: ConfigOrLambda<Inputs, Outputs>
    ): OptionalIdConfiguration => {
      return getConfigWithLambda(board, config);
    },
  });
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
const getConfigWithLambda = <In = InputValues, Out = OutputValues>(
  board: Breadboard,
  config: ConfigOrLambda<In, Out>
): OptionalIdConfiguration => {
  // Did we get a graph?
  const gotGraph =
    (config as GraphDescriptor).nodes !== undefined &&
    (config as GraphDescriptor).edges !== undefined &&
    (config as GraphDescriptor).kits !== undefined;

  // Look for functions, nodes and board capabilities.
  const gotBoard =
    gotGraph ||
    typeof config === "function" ||
    config instanceof Node ||
    ((config as BreadboardCapability).kind === "board" &&
      (config as BreadboardCapability).board);

  const result = (
    gotBoard
      ? { board: gotGraph ? { kind: "board", board: config } : config }
      : config
  ) as OptionalIdConfiguration;

  // Convert passed JS function into a board node.
  if (typeof result.board === "function")
    result.board = board.lambda(result.board as LambdaFunction<In, Out>);

  return result;
};
