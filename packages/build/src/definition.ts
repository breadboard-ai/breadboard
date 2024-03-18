/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeInstance } from "./instance.js";
import type {
  NodeHandlerFunction,
  NodeDescriberFunction,
} from "@google-labs/breadboard";
import type {
  PortConfigMap,
  ConcreteValues,
  OutputPortReference,
  ValuesOrOutputPorts,
  PortConfig,
} from "./port.js";
import type { TypeScriptTypeFromBreadboardType } from "./type.js";
import type { CountUnion } from "./type-util.js";

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
>(
  inputs: I,
  outputs: ForbidMultiplePrimaries<O>,
  invoke: InvokeFunction<I, O>
): NodeDefinition<I, O> {
  validateOutputs(outputs);
  // TODO(aomarks) Remove the cast.
  const fn: InstantiateFunction<I, O> = ((params: ValuesOrOutputPorts<I>) => {
    return new NodeInstance(inputs, outputs, params);
  }) as InstantiateFunction<I, O>;
  const handler: StrictNodeHandler = {
    invoke: makeInvokeFunction(invoke, inputs),
    describe: makeDescribeFunction(inputs, outputs),
  };
  return Object.assign(fn, handler);
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

// To get errors in the right place, we're going to test if there are multiple
// primaries. If there are not, just return the type, everything is fine. If
// there are, return a version of the type which disallows primary. That way,
// the squiggly will appear on all the primaries.
type ForbidMultiplePrimaries<M extends PortConfigMap> =
  HasMultiplePrimaries<M> extends true
    ? { [K in keyof M]: Omit<M[K], "primary"> & { primary: false } }
    : M;

type HasMultiplePrimaries<M extends PortConfigMap> =
  CountUnion<PrimaryPortNames<M>> extends 0 | 1 ? false : true;

type PrimaryPortNames<M extends PortConfigMap> = {
  [K in keyof M]: M[K]["primary"] extends true ? K : never;
}[keyof M];

/**
 * The return type for {@link defineNodeType}. An instantiation function for use
 * in boards, and also a {@link NodeHandler} which can be added to kits.
 */
export type NodeDefinition<
  I extends PortConfigMap,
  O extends PortConfigMap,
> = InstantiateFunction<I, O> & StrictNodeHandler;

/**
 * A function that creates a {@link NodeInstance}.
 */
export type InstantiateFunction<
  DEF_INPUT_SHAPE extends PortConfigMap,
  DEF_OUTPUT_SHAPE extends PortConfigMap,
> =
  HasDynamicPorts<DEF_INPUT_SHAPE> extends true
    ? DynamicInstantiateFunction<DEF_INPUT_SHAPE, DEF_OUTPUT_SHAPE>
    : StaticInstantiateFunction<DEF_INPUT_SHAPE, DEF_OUTPUT_SHAPE>;

type HasDynamicPorts<SHAPE extends PortConfigMap> = SHAPE["*"] extends object
  ? true
  : false;

export type StaticInstantiateFunction<
  DEF_INPUT_SHAPE extends PortConfigMap,
  DEF_OUTPUT_SHAPE extends PortConfigMap,
> = (
  params: ValuesOrOutputPorts<DEF_INPUT_SHAPE>
) => NodeInstance<DEF_INPUT_SHAPE, DEF_OUTPUT_SHAPE>;

type DynamicInstantiateFunction<
  DEF_INPUT_SHAPE extends PortConfigMap,
  DEF_OUTPUT_SHAPE extends PortConfigMap,
> = <INSTANTIATE_PARAMS extends Record<string, unknown>>(
  params: StaticInstantiateParams<DEF_INPUT_SHAPE> & {
    [PORT_NAME in keyof INSTANTIATE_PARAMS]: PORT_NAME extends keyof DEF_INPUT_SHAPE
      ? ValueOrPort<DEF_INPUT_SHAPE[PORT_NAME]>
      : ValueOrPort<DEF_INPUT_SHAPE["*"]>;
  }
) => NodeInstance<
  DEF_INPUT_SHAPE & DynamicShape<DEF_INPUT_SHAPE, INSTANTIATE_PARAMS>,
  DEF_OUTPUT_SHAPE
>;

type ValueOrPort<CONFIG extends PortConfig> =
  | TypeScriptTypeFromBreadboardType<CONFIG["type"]>
  | OutputPortReference<CONFIG>;

type OmitStarPort<SHAPE extends PortConfigMap> = Omit<SHAPE, "*">;

type DynamicShape<
  DEF_INPUT_SHAPE extends PortConfigMap,
  INSTANTIATE_PARAMS extends Record<string, unknown>,
> = {
  [PORT_NAME in DynamicPortNames<DEF_INPUT_SHAPE, INSTANTIATE_PARAMS>]: {
    // TODO(aomarks) It would probably be better if we extracted the specific
    // type from INSTANTIATE_PARAMS here, but the type for all dynamic ports is
    // also OK.
    type: TypeScriptTypeFromBreadboardType<DEF_INPUT_SHAPE["*"]["type"]>;
  };
};

type StaticInstantiateParams<DEF_INPUT_SHAPE extends PortConfigMap> =
  ValuesOrOutputPorts<OmitStarPort<DEF_INPUT_SHAPE>>;

type DynamicPortNames<
  DEF_INPUT_SHAPE extends PortConfigMap,
  INSTANTIATE_PARAMS extends Record<string, unknown>,
> = keyof Omit<INSTANTIATE_PARAMS, keyof DEF_INPUT_SHAPE>;

// TODO(aomarks) Is there a better way to create a terminal type like this which
// doesn't have any runtime component?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InvalidType = Symbol();

/**
 * A more tightly constrained version of {@link NodeHandler}.
 */
interface StrictNodeHandler {
  readonly invoke: NodeHandlerFunction;
  readonly describe: NodeDescriberFunction;
}

/**
 * Wrap the user's invoke function so that it (1) consistently returns a
 * promise, and (2) is typed for compatibility with the NodeHandlerFunction type
 * that is expected by the Breadboard runner, KitBuilder, etc.
 */
function makeInvokeFunction<I extends PortConfigMap, O extends PortConfigMap>(
  invoke: InvokeFunction<I, O>,
  inputs: I
): NodeHandlerFunction {
  if (inputs["*"]) {
    // Dynamic ports are possible. In this case, we split the values between
    // static and dynamic ports. We do this for type safety, because in
    // TypeScript it is unfortunately not possible to define an object where the
    // values of the unknown keys are of one type, and the known keys are of an
    // incompatible type.
    return (values) => {
      const staticValues: Record<string, unknown> = {};
      const dynamicValues: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(values)) {
        if (inputs[name] !== undefined) {
          staticValues[name] = value;
        } else {
          dynamicValues[name] = value;
        }
      }
      // The user's invoke function is allowed to return a promise or a concrete
      // value, but we always return a promise so that any sync -> async change
      // this node might need to make in the future will not be a breaking change
      // for its consumers.
      return Promise.resolve(
        invoke(
          staticValues as StaticInvokeParams<I>,
          dynamicValues as DynamicInvokeParams<I>
        )
      );
    };
  }
  // Static ports only. We can just pass values through.
  return (values) => {
    return Promise.resolve(
      // Cast to StaticInvokeFunction is needed because TypeScript does not seem
      // to understand the type narrowing automatically here.
      (invoke as StaticInvokeFunction<I, O>)(
        // Cast to StaticInvokeParams is needed because at runtime we don't get
        // any guarantee about port shape and types.
        //
        // TODO(aomarks) Consider adding schema validation here so that we can
        // raise type errors automatically and prevent the invoke function from
        // being invoked with unexpected input types.
        values as StaticInvokeParams<I>
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

type InvokeFunction<
  I extends PortConfigMap,
  O extends PortConfigMap,
> = I["*"] extends never
  ? StaticInvokeFunction<I, O>
  : DynamicInvokeFunction<I, O>;

type StaticInvokeFunction<I extends PortConfigMap, O extends PortConfigMap> = (
  params: StaticInvokeParams<I>
) => InvokeReturn<O> | Promise<InvokeReturn<O>>;

type DynamicInvokeFunction<I extends PortConfigMap, O extends PortConfigMap> = (
  staticParams: StaticInvokeParams<I>,
  dynamicParams: DynamicInvokeParams<I>
) => InvokeReturn<O> | Promise<InvokeReturn<O>>;

type StaticInvokeParams<Ports extends PortConfigMap> = Omit<
  ConcreteValues<Ports>,
  "*"
>;

type DynamicInvokeParams<I extends PortConfigMap> = Record<keyof I, never> &
  Record<string, TypeScriptTypeFromBreadboardType<I["*"]["type"]>>;

type InvokeReturn<Ports extends PortConfigMap> = ConcreteValues<Ports>;
