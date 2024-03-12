/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeInstance, type InstantiateParams } from "./instance.js";
import type {
  NodeHandlerFunction,
  NodeDescriberFunction,
} from "@google-labs/breadboard";
import type { PortConfigMap, ConcreteValues } from "./port.js";

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
  I extends PortConfigMap,
  O extends PortConfigMap,
>(inputs: I, outputs: O, invoke: InvokeFunction<I, O>): NodeDefinition<I, O> {
  const def = (params: InstantiateParams<I>) => {
    return new NodeInstance(inputs, outputs, params);
  };
  def.invoke = makeInvokeFunction(invoke);
  def.describe = makeDescribeFunction(inputs, outputs);
  return def;
}

export interface NodeDefinition<
  I extends PortConfigMap,
  O extends PortConfigMap,
> {
  (params: InstantiateParams<I>): NodeInstance<I, O>;
  readonly invoke: NodeHandlerFunction;
  readonly describe: NodeDescriberFunction;
}

/**
 * Wrap the user's invoke function so that it (1) consistently returns a
 * promise, and (2) is typed for compatibility with the NodeHandlerFunction type
 * that is expected by the Breadboard runner, KitBuilder, etc.
 */
function makeInvokeFunction<I extends PortConfigMap, O extends PortConfigMap>(
  invoke: InvokeFunction<I, O>
): NodeHandlerFunction {
  return (inputs) => {
    // The user's invoke function is allowed to return a promise or a concrete
    // value, but we always return a promise so that any sync -> async change
    // this node might need to make in the future will not be a breaking change
    // for its consumers.
    return Promise.resolve(
      invoke(
        // TODO(aomarks) This cast is needed because at runtime we don't get any
        // guarantee about port shape and types. Consider adding schema
        // validation here so that we can raise type errors automatically and
        // prevent the invoke function from being invoked with unexpected input
        // types.
        inputs as ConcreteValues<I>
      )
    );
  };
}

/**
 * Generate a JSON schema that describes the input and output ports of this node
 * type, and wrap that in a promise-returning function (a function is expected
 * because some node types change their shape at runtime).
 */
function makeDescribeFunction<I extends PortConfigMap, O extends PortConfigMap>(
  inputs: I,
  outputs: O
): NodeDescriberFunction {
  // Note result is memoized. This is a monmorphic node, so the ports never
  // change.
  const result = Promise.resolve({
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        [...Object.entries(inputs)].map(([title, { description, type }]) => {
          return [title, { title, description, type }];
        })
      ),
      required: [...Object.keys(inputs)],
    },
    outputSchema: {
      type: "object",
      properties: Object.fromEntries(
        [...Object.entries(outputs)].map(([title, { description, type }]) => {
          return [title, { title, description, type }];
        })
      ),
      required: [...Object.keys(outputs)],
    },
  });
  return () => result;
}

type InvokeFunction<I extends PortConfigMap, O extends PortConfigMap> =
  | InvokeFunctionSync<I, O>
  | InvokeFunctionAsync<I, O>;

type InvokeFunctionSync<I extends PortConfigMap, O extends PortConfigMap> = (
  params: InvokeParams<I>
) => InvokeReturn<O>;

type InvokeFunctionAsync<I extends PortConfigMap, O extends PortConfigMap> = (
  params: InvokeParams<I>
) => Promise<InvokeReturn<O>>;

type InvokeParams<Ports extends PortConfigMap> = ConcreteValues<Ports>;

type InvokeReturn<Ports extends PortConfigMap> = ConcreteValues<Ports>;
