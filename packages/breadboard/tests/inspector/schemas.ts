/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { inspectableGraph } from "../../src/inspector/graph.js";

test("input in ports are fixed", async (t) => {
  const graph = inspectableGraph({
    nodes: [
      {
        id: "node",
        type: "input",
      },
    ],
    edges: [],
  });
  const node = graph.nodeById("node");
  const ports = await node?.ports();
  t.true(ports?.inputs.fixed);
});

test("output out ports are fixed", async (t) => {
  const graph = inspectableGraph({
    nodes: [
      {
        id: "node",
        type: "output",
      },
    ],
    edges: [],
  });
  const node = graph.nodeById("node");
  const ports = await node?.ports();
  t.true(ports?.outputs.fixed);
});
