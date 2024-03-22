/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineMonomorphicNodeType,
  type MonomorphicDefinition,
  type MonomorphicInvokeFunction,
} from "./definition-monomorphic.js";
import {
  definePolymorphicNodeType,
  type PolymorphicDescribeFunction,
  type PolymorphicDefinition,
  type PolymorphicInvokeFunction,
} from "./definition-polymorphic.js";
import type { ForbidMultiplePrimaries } from "./definition.js";
import type { PortConfigMap } from "./port.js";

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
 *       type: "string",
 *       primary: true
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
  INPUTS extends PortConfigMap,
  OUTPUTS extends PortConfigMap,
>(
  inputs: INPUTS,
  outputs: ForbidMultiplePrimaries<OUTPUTS>,
  invoke: IsPolymorphic<INPUTS> extends true
    ? PolymorphicInvokeFunction<
        OmitDynamicPortConfig<INPUTS>,
        ExtractDynamicPortConfig<INPUTS>,
        OUTPUTS
      >
    : MonomorphicInvokeFunction<INPUTS, OUTPUTS>,
  describe?: IsPolymorphic<INPUTS> extends true
    ? PolymorphicDescribeFunction<
        OmitDynamicPortConfig<INPUTS>,
        ExtractDynamicPortConfig<INPUTS>
      >
    : never
): NodeDefinition<INPUTS, OUTPUTS> {
  validateOutputs(outputs);
  const def = isPolymorphic(inputs, invoke)
    ? definePolymorphicNodeType(
        omitDynamicPort(inputs),
        // TODO(aomarks) Remove !
        inputs["*"]!,
        outputs,
        // TODO(aomarks) Remove cast
        invoke as PolymorphicInvokeFunction<
          OmitDynamicPortConfig<INPUTS>,
          ExtractDynamicPortConfig<INPUTS>,
          OUTPUTS
        >,
        describe
      )
    : defineMonomorphicNodeType(inputs, outputs, invoke);
  return def as NodeDefinition<INPUTS, OUTPUTS>;
}

function validateOutputs(outputs: PortConfigMap): void {
  const primaryPortNames = Object.entries(outputs)
    .filter(([, config]) => config.primary === true)
    .map(([key]) => key);
  if (primaryPortNames.length > 1) {
    throw new Error(
      "Node definition has more than one primary output port: " +
        primaryPortNames.join(", ")
    );
  }
}

function isPolymorphic<
  INPUTS extends PortConfigMap,
  OUTPUTS extends PortConfigMap,
>(
  inputs: INPUTS,
  invoke:
    | MonomorphicInvokeFunction<INPUTS, OUTPUTS>
    | PolymorphicInvokeFunction<
        OmitDynamicPortConfig<INPUTS>,
        ExtractDynamicPortConfig<INPUTS>,
        OUTPUTS
      >
): invoke is PolymorphicInvokeFunction<
  OmitDynamicPortConfig<INPUTS>,
  ExtractDynamicPortConfig<INPUTS>,
  OUTPUTS
> {
  return inputs["*"] !== undefined;
}

function omitDynamicPort<SHAPE extends PortConfigMap>(
  shape: SHAPE
): OmitDynamicPortConfig<SHAPE> {
  return Object.fromEntries(
    Object.entries(shape).filter(([name]) => name !== "*")
  ) as OmitDynamicPortConfig<SHAPE>;
}

type ExtractDynamicPortConfig<SHAPE extends PortConfigMap> = SHAPE["*"];

type OmitDynamicPortConfig<SHAPE extends PortConfigMap> = Omit<SHAPE, "*">;

type NodeDefinition<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> =
  IsPolymorphic<ISHAPE> extends true
    ? PolymorphicDefinition<
        OmitDynamicPortConfig<ISHAPE>,
        ExtractDynamicPortConfig<ISHAPE>,
        OSHAPE
      >
    : MonomorphicDefinition<ISHAPE, OSHAPE>;

type IsPolymorphic<ISHAPE extends PortConfigMap> = ISHAPE["*"] extends object
  ? true
  : false;
