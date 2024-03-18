/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeInstance } from "./instance.js";
import type { StaticInstantiateFunction } from "./definition.js";
import type { InputPort, OutputPort, PortConfig } from "./port.js";

// TODO(aomarks) Support primary ports in boards.
// TODO(aomarks) Support adding descriptions to board ports.

/**
 * Define a new Breadboard board.
 *
 * Example usage:
 *
 * ```ts
 * export const recipeMaker = board(
 *   // Inputs
 *   {recipeName},
 *   // Outputs
 *   {recipe: llmRecipeResult}
 * );
 * ```
 *
 * @param inputs The input ports that should be exposed from nodes in the board
 * and under which name. An object that maps from an exposed port name to an
 * input port from a node in the board.
 * @param output The output ports that should be exposed from nodes in the board
 * and under which name. An object that maps from an exposed port name to an
 * output port from a node in the board.
 * @return A {@link BoardDefinition} which can be serialized for execution or
 * distribution, and which can be instantiated for composition into another
 * board.
 */
export function board<I extends BoardInputs, O extends BoardOutputs>(
  inputs: I,
  outputs: O
): BoardDefinition<I, O> {
  return (params) =>
    new NodeInstance(
      boardPortsConfig(inputs),
      boardPortsConfig(outputs),
      params
    );
}

export type BoardDefinition<
  I extends BoardInputs,
  O extends BoardOutputs,
> = StaticInstantiateFunction<BoardPortConfig<I>, BoardPortConfig<O>>;

type BoardInputs = Record<string, InputPort<PortConfig>>;

type BoardOutputs = Record<string, OutputPort<PortConfig>>;

type BoardPortConfig<I extends BoardInputs | BoardOutputs> = {
  [PortName in keyof I]: I[PortName] extends
    | InputPort<infer PortConfig>
    | OutputPort<infer PortConfig>
    ? { type: PortConfig["type"] }
    : never;
};

function boardPortsConfig<IO extends BoardInputs | BoardOutputs>(
  portMap: IO
): BoardPortConfig<IO> {
  return Object.fromEntries(
    Object.entries(portMap).map(([name, config]) => [
      name,
      { type: config.type },
    ])
  ) as BoardPortConfig<IO>;
}
