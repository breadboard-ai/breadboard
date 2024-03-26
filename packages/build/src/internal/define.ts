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
 * The following example is of a monomorphic node, meaning its input and output
 * ports are fixed, are the same for all instances, and never change at runtime.
 *
 * ```ts
 * import {defineNodeType} from "@breadboard-ai/build";
 *
 * export const reverseString = defineNodeType({
 *   inputs: {
 *     forwards: {
 *       type: "string",
 *       description: "The string to reverse"
 *     }
 *   },
 *   outputs: {
 *     backwards: {
 *       type: "string",
 *       description: "The reversed string",
 *       // (Optional) Allow the node itself to act as a shortcut for
 *       // this output port when wiring up this node in a board.
 *       primary: true
 *     }
 *   },
 *   invoke: ({forwards}) => {
 *     return {
 *       backwards: forwards.split("").reverse().join("")
 *     }
 *   }
 * });
 * ```
 *
 * The following example is of a polymorphic node, meaning its input and/or
 * output ports are allowed to change at runtime. Note the use of the special
 * "*" port to signifiy a type constraint that applies to all dynamic ports.
 *
 * ```ts
 * import { defineNodeType, anyOf } from "@breadboard-ai/build";
 *
 * export const templater = defineNodeType({
 *   inputs: {
 *     template: {
 *       type: "string",
 *       description: "A template with {{placeholders}}.",
 *     },
 *     "*": {
 *       type: anyOf("string", "number"),
 *       description: "Values to fill into template's placeholders.",
 *     },
 *   },
 *   outputs: {
 *     result: {
 *       type: "string",
 *       description: "The template with placeholders substituted.",
 *     },
 *   },
 *   describe: ({ template }) => {
 *     return {
 *       inputs: Object.fromEntries(
 *         extractPlaceholders(template ?? "").map((name) => [
 *           name,
 *           { type: anyOf("string", "number") },
 *         ])
 *       ),
 *     };
 *   },
 *   invoke: ({ template }, placeholders) => {
 *     return {
 *       result: substituteTemplatePlaceholders(template, placeholders),
 *     };
 *   },
 * });
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
>(params: {
  name?: string;
  inputs: INPUTS;
  outputs: ForbidMultiplePrimaries<OUTPUTS>;
  invoke: IsPolymorphic<INPUTS> extends true
    ? PolymorphicInvokeFunction<
        OmitDynamicPortConfig<INPUTS>,
        ExtractDynamicPortConfig<INPUTS>,
        OUTPUTS
      >
    : MonomorphicInvokeFunction<INPUTS, OUTPUTS>;
  describe?: IsPolymorphic<INPUTS> extends true
    ? PolymorphicDescribeFunction<
        OmitDynamicPortConfig<INPUTS>,
        ExtractDynamicPortConfig<INPUTS>
      >
    : never;
}): NodeDefinition<INPUTS, OUTPUTS> {
  const { name, inputs, outputs, invoke, describe } = params;
  validateOutputs(outputs);
  const def = isPolymorphic(inputs, invoke)
    ? definePolymorphicNodeType(
        name ?? "TODO_UNNAMED_POLY",
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
    : defineMonomorphicNodeType(
        name ?? "TODO_UNNAMED_MONO",
        inputs,
        outputs,
        invoke
      );
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
