/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { editGraph } from "../../../src/editor/index.js";
import { GraphDescriptor, NodeHandler } from "../../../src/types.js";

export { testEditGraph, testSubGraph };

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
