/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from "node:test";
import { defineNodeType } from "../internal/define/define.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

test("error: mono/mono should not have describe", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
    },
    // @ts-expect-error
    describe: () => ({ inputs: [], outputs: [] }),
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: mono/poly must have describe", () => {
  // @ts-expect-error
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "number" },
    },
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: non-reflective poly/poly must have describe", () => {
  // @ts-expect-error
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "string" },
    },
    invoke: () => ({ so1: "so1" }),
  });
});

test("describe is lenient with odd TypeScript types", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      outputFoo: { type: "boolean" },
    },
    outputs: {
      "*": { type: "unknown" },
    },
    describe: ({ outputFoo }) => ({
      /** See {@link DynamicInputPorts} for why this is an interesting case. */
      outputs: outputFoo ? { foo: { description: "foo" } } : {},
    }),
    invoke: () => ({}),
  });
});
