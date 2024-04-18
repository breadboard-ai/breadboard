/* eslint-disable @typescript-eslint/ban-types */
/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CountUnion, Expand } from "../common/type-util.js";
import type {
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  InputPortConfig,
  OutputPortConfig,
  PortConfig,
  PortConfigs,
  StaticInputPortConfig,
  StaticOutputPortConfig,
} from "./config.js";
import { DefinitionImpl, type Definition } from "./definition.js";

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
 *   name: "reverseString",
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
 *       // (Optional) Allow the node itself to act`a shortcut for
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
 *   name: "templater",
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
  I extends Record<string, InputPortConfig>,
  O extends Record<string, OutputPortConfig>,
  F extends LooseInvokeFn<I>,
  D extends LooseDescribeFn,
>(
  params: {
    // Start with a loose type to help TypeScript bind the generics.
    name: string;
    inputs: I;
    outputs: O;
    invoke: F;
    describe?: D;
  } & {
    // Then narrow down the types with further constraints. This 2-step
    // approach lets us generate additional and more precise errors.
    inputs: StrictInputs<I>;
    outputs: StrictOutputs<O>;
    invoke: StrictInvokeFn<I, O, F>;
  } & StrictDescribeFn<I, O>
): Definition<
  Expand<GetStaticTypes<I>>,
  Expand<GetStaticTypes<O>>,
  GetDynamicTypes<I>,
  GetDynamicTypes<O>,
  GetReflective<O>,
  GetPrimary<I>,
  GetPrimary<O>
> {
  if (!params.name) {
    throw new Error("params.name is required");
  }
  if (!params.inputs) {
    throw new Error("params.inputs is required");
  }
  if (!params.outputs) {
    throw new Error("params.outputs is required");
  }
  if (!params.invoke) {
    throw new Error("params.invoke is required");
  }
  const impl = new DefinitionImpl<
    Expand<GetStaticTypes<I>>,
    Expand<GetStaticTypes<O>>,
    GetDynamicTypes<I>,
    GetDynamicTypes<O>,
    GetReflective<O>,
    GetPrimary<I>,
    GetPrimary<O>
  >(
    params.name,
    omitDynamic(params.inputs),
    omitDynamic(params.outputs),
    params.inputs["*"],
    params.outputs["*"],
    primary(params.inputs),
    primary(params.outputs),
    params.invoke as Function as (
      staticParams: Record<string, JsonSerializable>,
      dynamicParams: Record<string, JsonSerializable>
    ) => { [K: string]: JsonSerializable },
    params.describe as Function as (
      staticParams: Record<string, JsonSerializable>,
      dynamicParams: Record<string, JsonSerializable>
    ) => {
      inputs?: string[];
      outputs?: string[];
    }
  );
  return Object.assign(impl.instantiate.bind(impl), {
    invoke: impl.invoke.bind(impl),
    describe: impl.describe.bind(impl),
  });
}

function omitDynamic(configs: PortConfigs): PortConfigs {
  return Object.fromEntries(
    Object.entries(configs).filter(([name]) => name !== "*")
  );
}

function primary(configs: PortConfigs): keyof typeof configs | undefined {
  const primaries = Object.entries(configs).filter(
    ([, config]) => "primary" in config && config.primary
  );
  if (primaries.length > 1) {
    throw new Error("Too many primaries");
  }
  return primaries[0]?.[0];
}

type StrictInputs<I extends Record<string, InputPortConfig>> = {
  [K in keyof I]: K extends "*"
    ? StrictMatch<I[K], DynamicInputPortConfig>
    : StrictMatch<I[K], StaticInputPortConfig>;
} & ForbidMultiplePrimaries<I>;

type StrictOutputs<O extends Record<string, OutputPortConfig>> = {
  [K in keyof O]: K extends "*"
    ? StrictMatch<O[K], DynamicOutputPortConfig>
    : StrictMatch<O[K], StaticOutputPortConfig>;
} & ForbidMultiplePrimaries<O>;

/**
 * Check that ACTUAL is assignable to EXPECTED and that there are no excess
 * properties.
 */
type StrictMatch<ACTUAL, EXPECTED> = {
  [K in keyof ACTUAL]: K extends keyof EXPECTED ? EXPECTED[K] : never;
};

type ForbidMultiplePrimaries<C extends Record<string, PortConfig>> =
  CountUnion<PrimaryPortNames<C>> extends 0 | 1
    ? C
    : { [K in keyof C]: Omit<C[K], "primary"> & { primary: never } };

type PrimaryPortNames<C extends Record<string, PortConfig>> = {
  [K in keyof C]: C[K] extends StaticInputPortConfig | StaticOutputPortConfig
    ? C[K]["primary"] extends true
      ? K
      : never
    : never;
}[keyof C];

type LooseInvokeFn<I extends Record<string, InputPortConfig>> = Expand<
  (
    staticParams: Expand<StaticInvokeParams<I>>,
    dynamicParams: Expand<DynamicInvokeParams<I>>
  ) =>
    | { [K: string]: JsonSerializable }
    | Promise<{ [K: string]: JsonSerializable }>
>;

type StrictInvokeFn<
  I extends Record<string, InputPortConfig>,
  O extends Record<string, OutputPortConfig>,
  F extends LooseInvokeFn<I>,
> = (
  staticInputs: Expand<StaticInvokeParams<I>>,
  dynamicInputs: Expand<DynamicInvokeParams<I>>
) => StrictInvokeFnReturn<I, O, F> | Promise<StrictInvokeFnReturn<I, O, F>>;

type StrictInvokeFnReturn<
  I extends Record<string, InputPortConfig>,
  O extends Record<string, OutputPortConfig>,
  F extends LooseInvokeFn<I>,
> = {
  [K in keyof Omit<O, "*">]: Convert<O[K]>;
} & {
  [K in keyof ReturnType<
    F extends (...args: unknown[]) => unknown ? F : never
  >]: K extends keyof O
    ? Convert<O[K]>
    : O["*"] extends DynamicOutputPortConfig
      ? Convert<O["*"]>
      : never;
};

type StaticInvokeParams<I extends Record<string, InputPortConfig>> = {
  [K in keyof Omit<I, "*">]: Convert<I[K]>;
};

type DynamicInvokeParams<I extends Record<string, InputPortConfig>> =
  I["*"] extends DynamicInputPortConfig
    ? { [K: string]: Convert<I["*"]> }
    : // eslint-disable-next-line @typescript-eslint/ban-types
      {};

type GetStaticTypes<C extends Record<string, PortConfig>> = {
  [K in Exclude<keyof C, "*">]: K extends "*" ? never : Convert<C[K]>;
};

type GetDynamicTypes<C extends Record<string, PortConfig>> =
  C["*"] extends PortConfig ? Convert<C["*"]> : undefined;

type GetPrimary<C extends Record<string, PortConfig>> = {
  [K in keyof Omit<C, "*">]: C[K] extends
    | StaticInputPortConfig
    | StaticOutputPortConfig
    ? C[K]["primary"] extends true
      ? K
      : undefined
    : undefined;
}[keyof Omit<C, "*">];

type GetReflective<O extends Record<string, OutputPortConfig>> =
  O["*"] extends DynamicOutputPortConfig
    ? O["*"]["reflective"] extends true
      ? true
      : false
    : false;

type Convert<C extends PortConfig> = ConvertBreadboardType<C["type"]>;

type LooseDescribeFn = Function;

export type DynamicInputPorts =
  | string[]
  | { [K: string]: { description: string } };

type StrictDescribeFn<
  I extends Record<string, InputPortConfig>,
  O extends Record<string, OutputPortConfig>,
> = I["*"] extends DynamicInputPortConfig
  ? O["*"] extends DynamicOutputPortConfig
    ? O["*"]["reflective"] extends true
      ? {
          // poly/poly reflective
          describe?: (
            staticInputs: Expand<StaticInvokeParams<I>>,
            dynamicInputs: Expand<DynamicInvokeParams<I>>
          ) => {
            inputs: DynamicInputPorts;
            outputs?: never;
          };
        }
      : {
          // poly/poly non-reflective
          describe: (
            staticInputs: Expand<StaticInvokeParams<I>>,
            dynamicInputs: Expand<DynamicInvokeParams<I>>
          ) => {
            inputs?: DynamicInputPorts;
            outputs: DynamicInputPorts;
          };
        }
    : {
        // poly/mono
        describe?: (
          staticInputs: Expand<StaticInvokeParams<I>>,
          dynamicInputs: Expand<DynamicInvokeParams<I>>
        ) => {
          inputs: DynamicInputPorts;
          outputs?: never;
        };
      }
  : O["*"] extends DynamicOutputPortConfig
    ? {
        // mono/poly
        describe: (
          staticInputs: Expand<StaticInvokeParams<I>>,
          dynamicInputs: Expand<DynamicInvokeParams<I>>
        ) => {
          inputs?: never;
          outputs: DynamicInputPorts;
        };
      }
    : {
        // mono/mono
        describe?: never;
      };
