/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/index.js";
import { GraphDescriptor } from "../../src/types.js";

test("simple graph description works as expected", async (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "input" },
      { id: "b", type: "bar" },
      { id: "c", type: "output" },
    ],
    edges: [
      { from: "a", to: "b", in: "foo", out: "text" },
      { from: "b", to: "c", in: "text", out: "bar" },
    ],
  } satisfies GraphDescriptor;
  const inspectable = inspectableGraph(graph);
  const api = await inspectable.describe();
  t.deepEqual(api, {
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: {
          type: "string",
        },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: {
          type: "string",
        },
      },
      required: ["text"],
    },
  });
});
