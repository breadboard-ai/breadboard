/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Value } from "@breadboard-ai/build";
import type { OutputPort } from "@breadboard-ai/build/internal/common/port.js";
import type { Expand } from "@breadboard-ai/build/internal/common/type-util.js";
import type { Instance } from "@breadboard-ai/build/internal/define/instance.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "@breadboard-ai/build/internal/type-system/type.js";
import runJavascript from "./run-javascript.js";

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
  I extends Record<string, Value<JsonSerializable>>,
  O extends Record<string, BreadboardType>,
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
  fn: (params: Expand<StrictCodeFunctionParams<I>>) => ConvertBreadboardTypes<O>
): CodeNode<
  Expand<CodeNodeInputs<I>>,
  { [K in keyof O]: ConvertBreadboardType<O[K]> }
> {
  const node = runJavascript({
    code: fn.toString(),
    raw: true,
    ...(inputs as Record<string, JsonSerializable>),
  }) as CodeNode<Expand<CodeNodeInputs<I>>, ConvertBreadboardTypes<O>>;
  for (const [name, type] of Object.entries(outputs)) {
    // TODO(aomarks) This is a bit of a hacky way to materialize the dynamic
    // ports. Node definitions should probably have a more elegant way to
    // configure dynamic ports at instantiation time.
    const port = node.unsafeOutput(name);
    (port as Writable<typeof port>).type = type;
    (node.outputs as Record<string, OutputPort<JsonSerializable>>)[name] = port;
  }
  return node;
}

export type CodeNode<
  I extends Record<string, JsonSerializable>,
  O extends Record<string, JsonSerializable>,
> = ReturnType<typeof runJavascript> &
  Instance<
    { code: string; name: string; raw: boolean } & I,
    O,
    JsonSerializable,
    undefined,
    never,
    false
  >;

type CodeNodeInputs<I extends Record<string, Value<JsonSerializable>>> = {
  [K in keyof I]: I[K] extends Value<infer T> ? T : never;
};

type StrictCodeFunctionParams<
  I extends Record<string, Value<JsonSerializable>>,
> = {
  [K in keyof I]: I[K] extends Value<infer T> ? T : never;
};

type ConvertBreadboardTypes<T extends Record<string, BreadboardType>> = {
  [K in keyof T]: ConvertBreadboardType<T[K]>;
};

type Writable<T> = { -readonly [P in keyof T]: T[P] };
