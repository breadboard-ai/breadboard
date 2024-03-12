/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeDescriberFunction,
  NodeHandlerFunction,
} from "@google-labs/breadboard";
import type { NodeDefinition } from "./definition.js";
import { NodeInstance, type InstantiateParams } from "./instance.js";
import type { InputPort, OutputPort, PortConfig } from "./port.js";
import type { BreadboardType } from "./type.js";

// TODO(aomarks) There should be a chance to add data to the output node. You
// pass in the port, which determines the type, but everything else should be
// configurable (e.g. description). Maybe there is an option to automatically
// pull the description.

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
export function board<
  I extends Record<string, InputPort<PortConfig>>,
  O extends Record<string, OutputPort<PortConfig>>,
>(inputs: I, outputs: O): BoardDefinition<I, O> {
  const def = (
    params: InstantiateParams<BoardPortConfig<I>>
  ): BoardInstance<I, O> => {
    return new NodeInstance(
      boardPortsConfig(inputs),
      boardPortsConfig(outputs),
      params
    );
  };
  // TODO(aomarks) Implement (though, do we need to? maybe boards shouldn't have
  // invoke and describe?)
  def.invoke = (() => ({})) as unknown as NodeHandlerFunction;
  def.describe = (() => ({})) as unknown as NodeDescriberFunction;
  return def;
}

function boardPortsConfig<
  PortMap extends Record<
    string,
    InputPort<PortConfig> | OutputPort<PortConfig>
  >,
>(portMap: PortMap): BoardPortConfig<PortMap> {
  const configMap: Record<string, { type: BreadboardType }> = {};
  for (const [portName, { type }] of Object.entries(portMap)) {
    configMap[portName] = { type };
  }
  return configMap as BoardPortConfig<PortMap>;
}

export type BoardDefinition<
  I extends Record<string, InputPort<PortConfig>>,
  O extends Record<string, OutputPort<PortConfig>>,
> = NodeDefinition<BoardPortConfig<I>, BoardPortConfig<O>>;

export type BoardInstance<
  I extends Record<string, InputPort<PortConfig>>,
  O extends Record<string, OutputPort<PortConfig>>,
> = NodeInstance<BoardPortConfig<I>, BoardPortConfig<O>>;

type BoardPortConfig<
  PortMap extends Record<
    string,
    InputPort<PortConfig> | OutputPort<PortConfig>
  >,
> = {
  [PortName in keyof PortMap]: PortMap[PortName] extends
    | InputPort<infer PortConfig>
    | OutputPort<infer PortConfig>
    ? PortConfig
    : never;
};
