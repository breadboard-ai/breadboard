/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { Snapshot } from "../../../src/inspector/snapshot/snapshot.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import { MutableGraphImpl } from "../../../src/inspector/graph/mutable-graph.js";
import { makeTestGraphStore } from "../../helpers/_graph-store.js";
import { deepStrictEqual } from "node:assert";
import { SnapshotChangeSpec } from "../../../src/inspector/snapshot/types.js";

function mutable(graph: GraphDescriptor) {
  return new MutableGraphImpl(graph, makeTestGraphStore());
}

describe("Snapshot changes", async () => {
  it("correctly rebuilds graph", async () => {
    const blank = new Snapshot(mutable({ nodes: [], edges: [] }));
    deepStrictEqual(blank.changes, [
      {
        type: "newgraph",
        metadata: {},
        graphId: "",
      },
    ]);

    const withMetadata = new Snapshot(
      mutable({
        nodes: [],
        edges: [],
        metadata: {
          tags: ["published"],
        },
      })
    );
    deepStrictEqual(withMetadata.changes, [
      {
        type: "newgraph",
        metadata: {},
        graphId: "",
      },
      {
        type: "changegraphmetadata",
        graphId: "",
        metadata: {
          tags: ["published"],
        },
      },
    ] satisfies SnapshotChangeSpec[]);
  });
});
