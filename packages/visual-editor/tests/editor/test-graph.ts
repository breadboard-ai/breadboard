/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { ok as nodeOk } from "node:assert";
import { editGraph } from "../helpers/_editor.js";

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
        type: "test:foo",
      },
      {
        id: "node4",
        type: "test:bar",
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
          type: "test:foo",
        },
        {
          id: "node2",
          type: "test:bar",
        },
      ],
      edges: [{ from: "node0", out: "out", to: "node0", in: "in" }],
    },
    {}
  );
}
