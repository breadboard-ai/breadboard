/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeInstance } from "./instance.js";
import type { PortConfigMap } from "./port.js";
import type { TypeScriptTypeFromBreadboardType } from "./type.js";

/**
 * Define a new Breadboard node type.
 *
 * Note that it is usually preferable to use the `board` function to compose
 * existing node types, instead of using this function to define a new node
 * type.
 *
 * Example usage:
 *
 * ```ts
 * export const reverseString = defineNodeType(
 *   // Inputs
 *   {
 *     forwards: {
 *       type: "string"
 *     }
 *   },
 *   // Outputs
 *   {
 *     backwards: {
 *       type: "string"
 *     }
 *   },
 *   // Invoke function
 *   ({forwards}) => {
 *     return {
 *       backwards: forwards.split("").reverse().join("")
 *     }
 *   }
 * );
 * ```
 *
 * @param inputs An object that maps from input port name to the
 * {@link PortConfig} for that input port.
 * @param output An object that maps from output port name to the
 * {@link PortConfig} for that output port.
 * @param invoke The function that will be called when this node is active in a
 * board. Receives an object that maps from input port name to the most recent
 * concrete value received on that port. Returns an object that maps from output
 * port name to the oncrete value that should be sent on that port.
 * @return A {@link NodeDefinition} which can be instantiated, whose outputs can
 * be wired to the inputs of other nodes, and which can be encapsulated into a
 * `board` for execution.
 */
export function defineNodeType<
  I extends PortConfigMap,
  O extends PortConfigMap,
>(inputs: I, outputs: O, invoke: InvokeFunction<I, O>): NodeDefinition<I, O> {
  const def = () => {
    return new NodeInstance(inputs, outputs);
  };
  def.inputs = inputs;
  def.outputs = outputs;
  def.invoke = invoke;
  return def;
}

export interface NodeDefinition<
  I extends PortConfigMap,
  O extends PortConfigMap,
> {
  (): NodeInstance<I, O>;
  readonly inputs: I;
  readonly outputs: O;
  readonly invoke: InvokeFunction<I, O>;
}

type InvokeFunction<I extends PortConfigMap, O extends PortConfigMap> = (
  params: InvokeParams<I>
) => InvokeReturn<O>;

type InvokeParams<Ports extends PortConfigMap> = {
  [PortName in keyof Ports]: TypeScriptTypeFromBreadboardType<
    Ports[PortName]["type"]
  >;
};

export type InvokeReturn<Ports extends PortConfigMap> = {
  [PortName in keyof Ports]: TypeScriptTypeFromBreadboardType<
    Ports[PortName]["type"]
  >;
};
