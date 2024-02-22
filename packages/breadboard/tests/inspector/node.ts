/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/index.js";

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
