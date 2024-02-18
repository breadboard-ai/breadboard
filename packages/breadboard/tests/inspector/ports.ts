/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { inspectableGraph } from "../../src/inspector/graph.js";

test("collectPorts correctly reports edges", async (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "input" },
      { id: "b", type: "bar" },
      { id: "c", type: "output" },
      { id: "d", type: "baz" },
    ],
    edges: [
      { from: "a", to: "b", in: "foo", out: "text" },
      { from: "d", to: "b", in: "foo", out: "baz" },
      { from: "b", to: "c", in: "text", out: "bar" },
    ],
  } satisfies GraphDescriptor;
  const inspectable = inspectableGraph(graph);
  const b = inspectable.nodeById("b");
  const ports = await b?.ports();
  const inputs = ports?.inputs?.ports;
  const outputs = ports?.outputs?.ports;
  t.deepEqual(
    inputs?.flatMap((p) =>
      p.edges?.map((e) => {
        return {
          in: e.in,
          out: e.out,
          from: e.from.descriptor.id,
          to: e.to.descriptor.id,
        };
      })
    ),
    [
      { in: "foo", out: "text", from: "a", to: "b" },
      { in: "foo", out: "baz", from: "d", to: "b" },
    ]
  );
  t.deepEqual(
    outputs?.flatMap((p) =>
      p.edges?.map((e) => {
        return {
          in: e.in,
          out: e.out,
          from: e.from.descriptor.id,
          to: e.to.descriptor.id,
        };
      })
    ),
    [{ in: "text", out: "bar", from: "b", to: "c" }]
  );
});
