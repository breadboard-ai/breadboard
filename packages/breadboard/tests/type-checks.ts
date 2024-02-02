/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This file is used to make assertions about the type system of Breadboard.
 *
 * Use a `@ts-expect-error <description>` comment to assert that an expression
 * should result in an error. These assertions are checked by `npm run
 * build:tsc`.
 *
 * Use a `$ExpectType <type>` comment above an expression to assert its type.
 * Note that it needs to match the type signature exactly. These assertions are
 * checked by `npm run lint` which is configured to use
 * https://github.com/JoshuaKGoldberg/eslint-plugin-expect-type.
 */

import { board, base } from "@google-labs/breadboard";
import type { InputValues } from "../src/types.js";

// Automatic input node ports should be typed as `unknown` by default.
board(({ foo, bar }) => {
  // $ExpectType AbstractValue<unknown> & ((config?: BuilderNodeConfig<InputValues> | undefined) => NodeProxy<InputValues, OutputValues>)
  foo;

  // $ExpectType AbstractValue<unknown> & ((config?: BuilderNodeConfig<InputValues> | undefined) => NodeProxy<InputValues, OutputValues>)
  bar;
});

// Automatic input node ports should be typed according to the board call's
// generic parameters.
board<{ foo: string; bar: number }>(({ foo, bar }) => {
  // $ExpectType AbstractValue<string> & ((config?: BuilderNodeConfig<InputValues> | undefined) => NodeProxy<InputValues, OutputValues>)
  foo;

  // $ExpectType AbstractValue<number> & ((config?: BuilderNodeConfig<InputValues> | undefined) => NodeProxy<InputValues, OutputValues>)
  bar;
});

// Automatic input node port's isString(), isNumber() etc. methods should return
// a version of that port with a different type.
board(({ foo }) => {
  // $ExpectType AbstractValue<string>
  foo.isString();

  // $ExpectType AbstractValue<number>
  foo.isNumber();
});

// @ts-expect-error Passing an automatic input port to an automatic output of a
// different type.
board<{ foo: string }, { foo: number }>(({ foo }) => {
  return { foo };
});

// @ts-expect-error Passing a weakly typed automatic input port to a strongly
// typed automatic output port.
board<InputValues, { foo: number }>(({ foo }) => {
  return { foo };
});

// TODO(aomarks) This should fail but doesn't.
// // @ts-expect-error Passing a strongly typed automatic input port to a weakly
// // typed automatic output port.
// board<{ foo: number }>(({ foo }) => {
//   return { foo };
// });

// Directly created input nodes should be typed as `unknown` by default.
board(() => {
  // $ExpectType NodeProxy<InputValues, OutputValues>
  const inputs = base.input({ $id: "input-1" });

  // $ExpectType AbstractValue<unknown> & ((...args: unknown[]) => unknown) & ((...args: unknown[]) => unknown)
  inputs.foo;

  // $ExpectType AbstractValue<unknown> & ((...args: unknown[]) => unknown) & ((...args: unknown[]) => unknown)
  inputs.bar;
});

// Directly created input node port's isString(), isNumber() etc. methods should
// return a version of that port with a different type.
board(() => {
  // $ExpectType NodeProxy<InputValues, OutputValues>
  const inputs = base.input({ $id: "input-1" });

  // $ExpectType AbstractValue<string>
  inputs.foo.isString();

  // $ExpectType AbstractValue<number>
  inputs.bar.isNumber();
});
