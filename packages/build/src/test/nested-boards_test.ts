/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import {
  anyOf,
  board,
  defineNodeType,
  input,
  object,
  serialize,
} from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";

// $ExpectType Definition<{ board: string | { [x: string]: JsonSerializable; }; }, { result: JsonSerializable; }, undefined, undefined, never, false, false, false, { board: { board: true; }; }>
const nodeThatTakesBoard = defineNodeType({
  name: "boardnode",
  inputs: {
    board: {
      type: anyOf("string", object({}, "unknown")),
      behavior: ["board"],
    },
  },
  outputs: {
    result: {
      type: "unknown",
    },
  },
  invoke: () => ({ result: 123 }),
});

const nestedBoard = (() => {
  const strToNumNode = defineNodeType({
    name: "str2num",
    inputs: {
      str: {
        type: "string",
      },
    },
    outputs: {
      num: {
        type: "number",
      },
    },
    invoke: ({ str }) => ({ num: Number(str) }),
  });
  const str = input();
  const { num } = strToNumNode({ str }).outputs;
  return board({ inputs: { str }, outputs: { num } });
})();

test("can pass board path string", () => {
  const { result } = nodeThatTakesBoard({ board: "local.bgl.json" }).outputs;
  const boardDef = board({ inputs: {}, outputs: { result } });
  assert.deepEqual(serialize(boardDef), {
    edges: [
      {
        from: "boardnode-0",
        in: "result",
        out: "result",
        to: "output-0",
      },
    ],
    nodes: [
      {
        configuration: {
          schema: {
            properties: {
              result: {
                type: [
                  "array",
                  "boolean",
                  "null",
                  "number",
                  "object",
                  "string",
                ],
              },
            },
            required: ["result"],
            type: "object",
          },
        },
        id: "output-0",
        type: "output",
      },
      {
        configuration: {
          board: "local.bgl.json",
        },
        id: "boardnode-0",
        type: "boardnode",
      },
    ],
  });
});

test("can pass nested board", () => {
  const { result: result1 } = nodeThatTakesBoard({
    board: nestedBoard,
  }).outputs;
  const { result: result2 } = nodeThatTakesBoard({
    board: nestedBoard,
  }).outputs;
  const boardDef = board({ inputs: {}, outputs: { result1, result2 } });
  const serialized = serialize(boardDef);
  console.log(JSON.stringify(serialized, null));
  assert.deepEqual(serialized, {
    edges: [
      { from: "boardnode-0", to: "output-0", out: "result", in: "result1" },
      { from: "boardnode-1", to: "output-0", out: "result", in: "result2" },
    ],
    nodes: [
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              result1: {
                type: [
                  "array",
                  "boolean",
                  "null",
                  "number",
                  "object",
                  "string",
                ],
              },
              result2: {
                type: [
                  "array",
                  "boolean",
                  "null",
                  "number",
                  "object",
                  "string",
                ],
              },
            },
            required: ["result1", "result2"],
          },
        },
      },
      {
        id: "boardnode-0",
        type: "boardnode",
        configuration: {
          board: {
            kind: "board",
            path: "#subgraph-0",
          },
        },
      },
      {
        id: "boardnode-1",
        type: "boardnode",
        configuration: {
          board: {
            kind: "board",
            path: "#subgraph-1",
          },
        },
      },
    ],
    graphs: {
      "subgraph-0": {
        edges: [
          { from: "input-0", to: "str2num-0", out: "str", in: "str" },
          { from: "str2num-0", to: "output-0", out: "num", in: "num" },
        ],
        nodes: [
          {
            id: "input-0",
            type: "input",
            configuration: {
              schema: {
                type: "object",
                properties: { str: { type: "string" } },
                required: ["str"],
              },
            },
          },
          {
            id: "output-0",
            type: "output",
            configuration: {
              schema: {
                type: "object",
                properties: { num: { type: "number" } },
                required: ["num"],
              },
            },
          },
          { id: "str2num-0", type: "str2num", configuration: {} },
        ],
      },
      "subgraph-1": {
        edges: [
          { from: "input-0", to: "str2num-0", out: "str", in: "str" },
          { from: "str2num-0", to: "output-0", out: "num", in: "num" },
        ],
        nodes: [
          {
            id: "input-0",
            type: "input",
            configuration: {
              schema: {
                type: "object",
                properties: { str: { type: "string" } },
                required: ["str"],
              },
            },
          },
          {
            id: "output-0",
            type: "output",
            configuration: {
              schema: {
                type: "object",
                properties: { num: { type: "number" } },
                required: ["num"],
              },
            },
          },
          { id: "str2num-0", type: "str2num", configuration: {} },
        ],
      },
    },
  });
});

test("error passing invalid types as boards", () => {
  // @ts-expect-error
  nodeThatTakesBoard({ board: 123 });

  // @ts-expect-error
  nodeThatTakesBoard({ board: ["local.bgl.json"] });
});
