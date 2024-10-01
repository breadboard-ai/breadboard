/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/graph.js";
import { GraphDescriptor } from "@breadboard-ai/types";

test("inspectableNode correctly returns node configuration", (t) => {
  const graph = {
    nodes: [
      {
        id: "a",
        type: "foo",
        configuration: {
          foo: "test",
        },
      },
    ],
    edges: [],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(inspectable.nodeById("a")?.configuration(), { foo: "test" });
});

test("inspectableNode correctly returns node title", (t) => {
  {
    const graph = {
      nodes: [
        {
          id: "a",
          type: "foo",
        },
      ],
      edges: [],
    };
    const inspectable = inspectableGraph(graph);
    t.deepEqual(inspectable.nodeById("a")?.title(), "a");
  }
  {
    const graph = {
      nodes: [
        {
          id: "a",
          type: "foo",
          metadata: {
            title: "test",
          },
        },
      ],
      edges: [],
    };
    const inspectable = inspectableGraph(graph);
    t.deepEqual(inspectable.nodeById("a")?.title(), "test");
  }
});

test("InspectableNode instances are stable within InspectableGraph", (t) => {
  const graph = {
    nodes: [
      {
        id: "a",
        type: "foo",
      },
      {
        id: "b",
        type: "bar",
      },
    ],
    edges: [{ from: "a", to: "b" }],
  };
  const inspectable = inspectableGraph(graph);
  t.assert(inspectable.nodeById("a") === inspectable.nodeById("a"));
  t.assert(inspectable.nodeById("b") === inspectable.nodeById("b"));
  t.assert(inspectable.nodeById("a") === inspectable.entries()[0]);
  t.assert(inspectable.nodesByType("foo")[0] === inspectable.nodeById("a"));
});

test("A graph with no nodes doesn't cause errors", (t) => {
  const graph = {
    nodes: [],
    edges: [],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(inspectable.nodes(), []);
  t.deepEqual(inspectable.nodeById("a"), undefined);
  t.deepEqual(inspectable.nodesByType("foo"), []);
});

test("A graph with start tags is correctly interpreted", (t) => {
  const graph = {
    nodes: [
      {
        id: "a",
        type: "foo",
        metadata: {
          tags: ["start"],
        },
      },
      {
        id: "b",
        type: "bar",
        metadata: {
          tags: [{ type: "start", label: "describe" }],
        },
      },
    ],
    edges: [],
  } as GraphDescriptor;
  const inspectable = inspectableGraph(graph);
  const a = inspectable.nodeById("a");
  t.deepEqual(a?.startLabels(), ["default"]);
  t.is(a?.isEntry(), true);
  t.is(a?.isEntry("default"), true);
  t.is(a?.isEntry("describe"), false);
  const b = inspectable.nodeById("b");
  t.deepEqual(b?.startLabels(), ["describe"]);
  t.is(b?.isEntry("default"), false);
  t.is(b?.isEntry("describe"), true);

  t.deepEqual(
    inspectable.entries().map((n) => n.descriptor.id),
    ["a"]
  );
  t.deepEqual(
    inspectable.entries("default").map((n) => n.descriptor.id),
    ["a"]
  );
  t.deepEqual(
    inspectable.entries("describe").map((n) => n.descriptor.id),
    ["b"]
  );
});
