/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  array,
  board,
  defineNodeType,
  input,
  inputNode,
  serialize,
  starInputs,
} from "../index.js";

test("StarInputs type parameterization", () => {
  // $ExpectType StarInputs<string>
  starInputs({ type: "string" });

  // $ExpectType StarInputs<number[]>
  starInputs({ type: array("number") });
});

/**
 * A discrete component for testing that takes all * inputs and joins them.
 */
const lineCombiner = defineNodeType({
  name: "lineCombiner",
  inputs: { "*": { type: "string" } },
  outputs: { joined: { type: "string" } },
  invoke: ({ ...lines }) => ({
    joined: Object.values(lines).join(),
  }),
});

/**
 * A discrete component for testing that takes an array of inputs and joins them
 * (it doesn't have a "*" port).
 */
const nonDynamicLineCombiner = defineNodeType({
  name: "lineCombiner",
  inputs: { lines: { type: array("string") } },
  outputs: { joined: { type: "string" } },
  invoke: ({ lines }) => ({
    joined: Object.values(lines).join(),
  }),
});

test("can pass to dynamic discrete component", () => {
  const lines = starInputs({ type: "string" });
  lineCombiner({ "*": lines });
});

test.skip("error to pass to non-dynamic discrete component", () => {
  const starLines = starInputs({ type: "string" });
  const arrayLines = input({ type: array("string") });
  nonDynamicLineCombiner({
    lines: arrayLines,
    // TODO(aomarks) @ts-expect-error
    "*": starLines,
  });
});

test.skip("error to pass wrong type to discrete component", () => {
  const notLines = starInputs({ type: "number" });
  // TODO(aomarks) @ts-expect-error
  lineCombiner({ "*": notLines });
});

test("can pass to inputNode", () => {
  const starLines = starInputs({ type: "string" });
  // $ExpectType InputNode<{ "*": string; }>
  inputNode({ "*": starLines });
});

test.skip("can only pass to inputNode as *", () => {
  const starLines = starInputs({ type: "string" });
  // TODO(aomarks) @ts-expect-error
  inputNode({ foo: starLines });
});

test("can pass as board shorthand", () => {
  const starLines = starInputs({ type: "string" });
  // $ExpectType BoardDefinition<{ "*": string; }, {}>
  board({ inputs: { "*": starLines }, outputs: {} });
});

test.skip("can only pass to board shorthand as *", () => {
  const starLines = starInputs({ type: "string" });
  // TODO(aomarks) @ts-expect-error
  board({ inputs: { foo: starLines }, outputs: {} });
});

test("can serialize when passed to discrete component", () => {
  const lines = starInputs({ type: "string" });
  const { joined } = lineCombiner({ "*": lines }).outputs;
  const testBoard = board({ inputs: { "*": lines }, outputs: { joined } });
  const bgl = serialize(testBoard);
  assert.deepEqual(bgl, {
    edges: [
      { from: "input-0", to: "lineCombiner-0", out: "*", in: "" },
      { from: "lineCombiner-0", to: "output-0", out: "joined", in: "joined" },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: { type: "string" },
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { joined: { type: "string" } },
            required: ["joined"],
          },
        },
      },
      { id: "lineCombiner-0", type: "lineCombiner", configuration: {} },
    ],
  });
});
