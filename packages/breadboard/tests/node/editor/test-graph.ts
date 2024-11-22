/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { editGraph } from "../../../src/editor/index.js";
import { GraphDescriptor, NodeHandler } from "../../../src/types.js";
import { ok as nodeOk } from "node:assert";

export { testEditGraph, testSubGraph, testFilledOutSubGraph, ok, notOk };

function ok(
  result: { success: true } | { success: false; error: string }
): result is { success: true } {
  nodeOk(result.success, !result.success ? result.error : "");
  return result.success;
}

function notOk(
  result: { success: true } | { success: false; error: string }
): result is { success: false; error: string } {
  nodeOk(!result.success, !result.success ? result.error : "");
  return !result.success;
}

function testFilledOutSubGraph(): GraphDescriptor {
  return {
    title: "Test Filled Out Subgraph",
    nodes: [
      {
        id: "node3",
        type: "foo",
      },
      {
        id: "node4",
        type: "bar",
      },
    ],
    edges: [{ from: "node3", out: "out", to: "node4", in: "in" }],
  };
}
function testSubGraph(): GraphDescriptor {
  return {
    title: "Test Subgraph",
    nodes: [],
    edges: [],
  };
}

function testEditGraph() {
  return editGraph(
    {
      nodes: [
        {
          id: "node0",
          type: "foo",
        },
        {
          id: "node2",
          type: "bar",
        },
      ],
      edges: [{ from: "node0", out: "out", to: "node0", in: "in" }],
    },
    {
      kits: [
        {
          url: "",
          handlers: {
            foo: {
              invoke: async () => {},
              describe: async () => {
                return {
                  inputSchema: {
                    additionalProperties: false,
                    properties: {
                      in: { type: "string" },
                    },
                  },
                  outputSchema: {
                    additionalProperties: false,
                    properties: {
                      out: { type: "string" },
                    },
                  },
                };
              },
            } as NodeHandler,
            bar: {
              invoke: async () => {},
              describe: async () => {
                return {
                  inputSchema: {},
                  outputSchema: {
                    additionalProperties: false,
                    properties: {
                      out: { type: "string" },
                    },
                  },
                };
              },
            } as NodeHandler,
          },
        },
      ],
    }
  );
}
