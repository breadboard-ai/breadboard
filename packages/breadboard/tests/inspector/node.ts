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
