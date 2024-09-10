/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { board } from "../internal/board/board.js";
import { input } from "../internal/board/input.js";
import { serialize } from "../internal/board/serialize.js";
import { defineNodeType } from "../internal/define/define.js";
import { output } from "../internal/board/output.js";

const trivialNode = defineNodeType({
  name: "trivial",
  inputs: {
    trivialStrIn: { type: "string" },
    trivialNumIn: { type: "number" },
  },
  outputs: { trivialOut: { type: "string" } },
  invoke: ({ trivialStrIn, trivialNumIn }) => ({
    trivialOut: `${trivialStrIn}:${trivialNumIn}`,
  }),
});

test("can invoke one board in another", () => {
  const innerStrInput = input({ description: "innerStrInput" });
  const innerNumInput = input({ type: "number", description: "innerNumInput" });
  const innerNode = trivialNode({
    trivialStrIn: innerStrInput,
    trivialNumIn: innerNumInput,
  });
  const innerOutput = innerNode.outputs.trivialOut;
  const innerBoard = board({
    inputs: { innerStrInput, innerNumInput },
    outputs: { innerOutput },
  });

  const outerInput = input({ description: "outerInput" });
  const nestedBoard = innerBoard({
    innerStrInput: outerInput,
    innerNumInput: 42,
  });
  const outerOutput = nestedBoard.outputs.innerOutput;
  const outerBoard = board({
    inputs: { outerInput },
    outputs: { outerOutput },
  });

  const serialized = serialize(outerBoard);
  assert.deepEqual(serialized, {
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              outerInput: { type: "string", description: "outerInput" },
            },
            required: ["outerInput"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            required: ["outerOutput"],
            properties: {
              outerOutput: {
                type: "string",
              },
            },
          },
        },
      },
      {
        id: "invoke-0",
        type: "invoke",
        configuration: {
          $board: "#subgraph-0",
          innerNumInput: 42,
        },
      },
    ],
    edges: [
      {
        from: "input-0",
        out: "outerInput",
        to: "invoke-0",
        in: "innerStrInput",
      },
      {
        from: "invoke-0",
        out: "innerOutput",
        to: "output-0",
        in: "outerOutput",
      },
    ],
    graphs: {
      "subgraph-0": {
        edges: [
          {
            from: "input-0",
            in: "trivialNumIn",
            out: "innerNumInput",
            to: "trivial-0",
          },
          {
            from: "input-0",
            out: "innerStrInput",
            to: "trivial-0",
            in: "trivialStrIn",
          },
          {
            from: "trivial-0",
            out: "trivialOut",
            to: "output-0",
            in: "innerOutput",
          },
        ],
        nodes: [
          {
            id: "input-0",
            type: "input",
            configuration: {
              schema: {
                type: "object",
                properties: {
                  innerStrInput: {
                    type: "string",
                    description: "innerStrInput",
                  },
                  innerNumInput: {
                    type: "number",
                    description: "innerNumInput",
                  },
                },
                required: ["innerNumInput", "innerStrInput"],
              },
            },
          },
          {
            id: "output-0",
            type: "output",
            configuration: {
              schema: {
                type: "object",
                properties: { innerOutput: { type: "string" } },
                required: ["innerOutput"],
              },
            },
          },
          { id: "trivial-0", type: "trivial", configuration: {} },
        ],
      },
    },
  });
});

test("can invoke one board in another (output wrappers)", () => {
  const innerStrInput = input({ description: "innerStrInput" });
  const innerNumInput = input({ type: "number", description: "innerNumInput" });
  const innerNode = trivialNode({
    trivialStrIn: innerStrInput,
    trivialNumIn: innerNumInput,
  });
  const innerOutput = innerNode.outputs.trivialOut;
  const innerBoard = board({
    inputs: { innerStrInput, innerNumInput },
    outputs: {
      innerOutput: output(innerOutput, { description: "innerOutput" }),
    },
  });

  const outerInput = input({ description: "outerInput" });
  const nestedBoard = innerBoard({
    innerStrInput: outerInput,
    innerNumInput: 42,
  });
  const outerOutput = nestedBoard.outputs.innerOutput;
  const outerBoard = board({
    inputs: { outerInput },
    outputs: {
      outerOutput: output(outerOutput, { description: "outerOutput" }),
    },
  });

  const serialized = serialize(outerBoard);
  assert.deepEqual(serialized, {
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              outerInput: {
                type: "string",
                description: "outerInput",
              },
            },
            required: ["outerInput"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            required: ["outerOutput"],
            properties: {
              outerOutput: {
                type: "string",
                description: "outerOutput",
              },
            },
          },
        },
      },
      {
        id: "invoke-0",
        type: "invoke",
        configuration: {
          $board: "#subgraph-0",
          innerNumInput: 42,
        },
      },
    ],
    edges: [
      {
        from: "input-0",
        out: "outerInput",
        to: "invoke-0",
        in: "innerStrInput",
      },
      {
        from: "invoke-0",
        out: "innerOutput",
        to: "output-0",
        in: "outerOutput",
      },
    ],
    graphs: {
      "subgraph-0": {
        edges: [
          {
            from: "input-0",
            in: "trivialNumIn",
            out: "innerNumInput",
            to: "trivial-0",
          },
          {
            from: "input-0",
            out: "innerStrInput",
            to: "trivial-0",
            in: "trivialStrIn",
          },
          {
            from: "trivial-0",
            out: "trivialOut",
            to: "output-0",
            in: "innerOutput",
          },
        ],
        nodes: [
          {
            id: "input-0",
            type: "input",
            configuration: {
              schema: {
                type: "object",
                properties: {
                  innerStrInput: {
                    type: "string",
                    description: "innerStrInput",
                  },
                  innerNumInput: {
                    type: "number",
                    description: "innerNumInput",
                  },
                },
                required: ["innerNumInput", "innerStrInput"],
              },
            },
          },
          {
            id: "output-0",
            type: "output",
            configuration: {
              schema: {
                type: "object",
                properties: {
                  innerOutput: {
                    type: "string",
                    description: "innerOutput",
                  },
                },
                required: ["innerOutput"],
              },
            },
          },
          { id: "trivial-0", type: "trivial", configuration: {} },
        ],
      },
    },
  });
});

test("can invoke one board in another (indirect)", () => {
  const innerStrInput = input({ description: "innerStrInput" });
  const innerNumInput = input({ type: "number", description: "innerNumInput" });
  const innerNode = trivialNode({
    trivialStrIn: innerStrInput,
    trivialNumIn: innerNumInput,
  });
  const innerOutput = innerNode.outputs.trivialOut;
  const innerBoard = board({
    inputs: { innerStrInput, innerNumInput },
    outputs: { innerOutput },
  });

  const outerInput = input({ description: "outerInput" });
  const nestedBoard = innerBoard({
    innerStrInput: outerInput,
    innerNumInput: 42,
  });
  const outerNode = trivialNode({
    trivialStrIn: nestedBoard.outputs.innerOutput,
    trivialNumIn: 47,
  });
  const outerOutput = outerNode.outputs.trivialOut;
  const outerBoard = board({
    inputs: { outerInput },
    outputs: { outerOutput },
  });

  const serialized = serialize(outerBoard);
  assert.deepEqual(serialized, {
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              outerInput: { type: "string", description: "outerInput" },
            },
            required: ["outerInput"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { outerOutput: { type: "string" } },
            required: ["outerOutput"],
          },
        },
      },
      {
        id: "invoke-0",
        type: "invoke",
        configuration: { $board: "#subgraph-0", innerNumInput: 42 },
      },
      { id: "trivial-0", type: "trivial", configuration: { trivialNumIn: 47 } },
    ],
    edges: [
      {
        from: "input-0",
        to: "invoke-0",
        out: "outerInput",
        in: "innerStrInput",
      },
      {
        from: "invoke-0",
        to: "trivial-0",
        out: "innerOutput",
        in: "trivialStrIn",
      },
      {
        from: "trivial-0",
        to: "output-0",
        out: "trivialOut",
        in: "outerOutput",
      },
    ],
    graphs: {
      "subgraph-0": {
        edges: [
          {
            from: "input-0",
            to: "trivial-0",
            out: "innerNumInput",
            in: "trivialNumIn",
          },
          {
            from: "input-0",
            to: "trivial-0",
            out: "innerStrInput",
            in: "trivialStrIn",
          },
          {
            from: "trivial-0",
            to: "output-0",
            out: "trivialOut",
            in: "innerOutput",
          },
        ],
        nodes: [
          {
            id: "input-0",
            type: "input",
            configuration: {
              schema: {
                type: "object",
                properties: {
                  innerNumInput: {
                    type: "number",
                    description: "innerNumInput",
                  },
                  innerStrInput: {
                    type: "string",
                    description: "innerStrInput",
                  },
                },
                required: ["innerNumInput", "innerStrInput"],
              },
            },
          },
          {
            id: "output-0",
            type: "output",
            configuration: {
              schema: {
                type: "object",
                properties: { innerOutput: { type: "string" } },
                required: ["innerOutput"],
              },
            },
          },
          { id: "trivial-0", type: "trivial", configuration: {} },
        ],
      },
    },
  });
});
