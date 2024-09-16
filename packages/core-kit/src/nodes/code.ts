/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  extractTypeFromValue,
  toJSONSchema,
  type Value,
} from "@breadboard-ai/build";
import type { OutputPort } from "@breadboard-ai/build/internal/common/port.js";
import type { Expand } from "@breadboard-ai/build/internal/common/type-util.js";
import type { Instance } from "@breadboard-ai/build/internal/define/instance.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "@breadboard-ai/build/internal/type-system/type.js";
import runJavascript from "./run-javascript.js";
import type { Convergence } from "@breadboard-ai/build/internal/board/converge.js";
import type { Loopback } from "@breadboard-ai/build/internal/board/loopback.js";
import { StarInputs } from "@breadboard-ai/build/internal/board/star-inputs.js";

/**
 * The `code` function creates a {@link runJavascript} Breadboard node in a
 * type-safe manner. Usage:
 *
 * ```ts
 * import {code} from "@google-labs/core-kit";
 * import {board, input} from "@breadboard-ai/build";
 *
 * const forwards = input({ description: "A string to reverse" });
 *
 * const reversed = code({ forwards }, { reversed: "string" }, ({ forwards }) => ({
 *   reversed: str.split("").reverse().join(""),
 * }));
 *
 * export board({forwards}, {reversed: reversed.outputs.reversed});
 * ```
 */
export function code<
  I extends Record<
    string,
    Value<JsonSerializable> | StarInputs<JsonSerializable>
  >,
  O extends Record<string, BreadboardType | CodeOutputConfig>,
>(
  inputs: I,
  // TODO(aomarks) We could make the `outputs` parameter optional, but we'd have
  // to be careful with schema. What we'd need to do if `outputs` is missing is:
  //
  // 1. Infer the output ports from `ReturnType<fn>` instead of from `outputs`.
  //
  // 2. Return a node that has a magic `outputs` object. This `outputs` object
  //    would be a proxy that overloads `get` to automatically create output
  //    ports as they are accessed (same as what we do below, except deferred).
  //
  // 3. Deal with the fact that the runtime `type` of those ports will be too
  //    broad. It will be the base dynamic output type of `runJavascript`, which
  //    is any JSON serializable value.
  //
  //    This is OK when wiring to an input port because input ports already know
  //    their schema, and TypeScript will take care of making sure we only wire
  //    it to the right place.
  //
  //    However, if we want to use one of these outputs as a _board output_, we
  //    have a problem, since we need to write the schema to the output node
  //    configuration. So, we'll probably want to introduce a "weak typed"
  //    version of an `OutputPortReference`, which is accepted when wiring
  //    nodes, but NOT accepted when configuring board outputs. Then, we can
  //    update the `output` utility function to only take weak
  //    `OutputPortReferences` if the `output` has had its type explicitly
  //    specified.
  //
  outputs: O,
  fn: (
    params: Expand<StrictCodeFunctionParams<I>>
  ) =>
    | Expand<ConvertBreadboardTypes<O>>
    | { $error: string | { message: string } }
    | Promise<Expand<ConvertBreadboardTypes<O>>>
    | Promise<{ $error: string | { message: string } }>
): CodeNode<Expand<CodeNodeInputs<I>>, ConvertBreadboardTypes<O>> {
  // TODO(aomarks) Do we need any of this logic involving function names? Why
  // can't we just wrap the code in parens and invoke it like `(<fn>)()`.
  const id = inputs.$id as string | undefined;
  const jsFriendlyId = id === undefined ? "run" : id.replace(/-/g, "_");
  const [code, name] = serializeFunction(jsFriendlyId, fn);
  const node = runJavascript({
    code,
    name,
    raw: true,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(inputs)
          .filter(
            ([name]) => name !== "$id" && name !== "$metadata" && name !== "*"
          )
          .map(([name, value]) => [
            name,
            toJSONSchema(extractTypeFromValue(value)),
          ])
      ),
      ...(inputs["*"] !== undefined
        ? {
            additionalProperties: toJSONSchema(
              extractTypeFromValue(inputs["*"])
            ),
          }
        : {}),
    },
    outputSchema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(outputs).map(([name, output]) => [
          name,
          toJSONSchema(
            typeof output === "object" && "type" in output
              ? output.type
              : output
          ),
        ])
      ),
    },
    ...(inputs as Record<string, JsonSerializable>),
  }) as CodeNode<Expand<CodeNodeInputs<I>>, ConvertBreadboardTypes<O>>;
  for (const [name, type] of Object.entries(outputs)) {
    // TODO(aomarks) This is a bit of a hacky way to materialize the dynamic
    // ports. Node definitions should probably have a more elegant way to
    // configure dynamic ports at instantiation time.
    const port = node.unsafeOutput(name);
    (port as Writable<typeof port>).type =
      // TODO(aomarks) Need to also handle the undefined case. This type matters
      // in that it will determine what schema we write if this output is wired
      // to a board output.
      (type as CodeOutputConfig)["type"] ?? type;
    (node.outputs as Record<string, OutputPort<JsonSerializable>>)[name] = port;
  }
  // eslint-disable-next-line @typescript-eslint/ban-types
  node.test = fn as Function as CodeNode<
    Expand<CodeNodeInputs<I>>,
    ConvertBreadboardTypes<O>
  >["test"];
  return node;
}

export type CodeNode<
  I extends Record<string, JsonSerializable>,
  O extends Record<string, JsonSerializable | undefined>,
> = ReturnType<typeof runJavascript> &
  Instance<
    { code: string; name: string; raw: boolean } & I,
    O,
    JsonSerializable,
    false,
    never,
    false
  > & {
    test: (
      params: Expand<StrictCodeFunctionParams<I>>
    ) =>
      | Expand<O>
      | { $error: string | { message: string } }
      | Promise<Expand<O>>
      | Promise<{ $error: string | { message: string } }>;
  };

export interface CodeOutputConfig {
  type: BreadboardType;
  optional?: true;
}

type CodeNodeInputs<
  I extends Record<string, Value<JsonSerializable> | StarInputs>,
> = {
  [K in keyof I]: I[K] extends Value<infer T extends JsonSerializable>
    ? T
    : never;
};

type ConvertOutput<T extends BreadboardType | CodeOutputConfig> =
  T extends BreadboardType
    ? ConvertBreadboardType<T>
    : // TODO(aomarks) Not sure why I need the extends or never check here
      // given the constraint on T. Probably not enough to distinguish the two
      // types?
      T extends CodeOutputConfig
      ? T["optional"] extends true
        ? ConvertBreadboardType<T["type"]> | undefined
        : ConvertBreadboardType<T["type"]>
      : never;

type StrictCodeFunctionParams<
  I extends Record<string, Value<JsonSerializable> | StarInputs>,
> = {
  [K in keyof I as K extends "*"
    ? never
    : K extends "$id"
      ? never
      : K extends "$metadata"
        ? never
        : K]: I[K] extends
    | Convergence<infer T>
    | Loopback<infer T>
    | Value<infer T>
    ? T
    : never;
} & (I["*"] extends StarInputs<infer X> ? { [K: string]: X } : object);

type ConvertBreadboardTypes<
  T extends Record<string, BreadboardType | CodeOutputConfig>,
> = Expand<Optionalize<{ [K in keyof T]: ConvertOutput<T[K]> }>>;

type Optionalize<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
};

type Writable<T> = { -readonly [P in keyof T]: T[P] };

const serializeFunction = (
  name: string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  handlerFn: Function
) => {
  let code = handlerFn.toString();

  const arrowFunctionRegex = /(?:async\s*)?(\w+|\([^)]*\))\s*=>\s*/;
  const traditionalFunctionRegex =
    /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/;

  if (arrowFunctionRegex.test(code)) {
    code = `const ${name} = ${code};`;
  } else {
    const match = traditionalFunctionRegex.exec(code);
    if (match === null) throw new Error("Unexpected serialization: " + code);
    else name = match[1] || name;
  }
  return [code, name];
};

// eslint-disable-next-line @typescript-eslint/ban-types
type x = { foo: string } & {};
