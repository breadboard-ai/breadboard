/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  SelectionController,
  toEdgeIdentifier,
} from "../../../../../src/controller/subcontrollers/editor/selection/selection-controller.js";
import { GraphDescriptor, InspectableGraph } from "@breadboard-ai/types";
import { unwrap } from "../../../../../src/controller/decorators/utils/wrap-unwrap.js";

const testGraph: GraphDescriptor = {
  nodes: [
    { id: "a", type: "type" },
    { id: "b", type: "type" },
  ],
  edges: [
    { from: "a", to: "a", out: "a", in: "a" },
    { from: "a", to: "b", out: "a", in: "b" },
    { from: "a", to: "b", out: "*", in: "*" },
  ],
};

const id0 = testGraph.nodes[0].id;
const id1 = testGraph.nodes[1].id;
const edge0 = toEdgeIdentifier(testGraph.edges[0]);
const edge1 = toEdgeIdentifier(testGraph.edges[1]);
const edge2 = toEdgeIdentifier(testGraph.edges[2]);
const empty = {
  nodes: new Set(),
  edges: new Set(),
};
const full = {
  nodes: new Set([id0, id1]),
  edges: new Set([edge0, edge1, edge2]),
};

suite("SelectionController", () => {
  test("Add and remove nodes", async () => {
    const store = new SelectionController("Selection_1");
    await store.isHydrated;

    store.addNode(id0);
    store.addNode(id1);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set([id0, id1]),
      edges: new Set(),
    });

    store.removeNode(id0);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set([id1]),
      edges: new Set(),
    });

    store.removeNodes();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Edges", async () => {
    const store = new SelectionController("Selection_2");
    await store.isHydrated;

    store.addEdge(edge0);
    store.addEdge(edge1);
    store.addEdge(edge2);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set([edge0, edge1, edge2]),
    });

    store.removeEdge(edge0);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set([edge1, edge2]),
    });

    store.removeEdges();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Select All & clear", async () => {
    const store = new SelectionController("Selection_3");
    await store.isHydrated;

    store.selectAll(testGraph);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), full);

    store.clear();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Select All (Inspectable) & clear", async () => {
    const store = new SelectionController("Selection_3");
    await store.isHydrated;

    const inspectableGraph = {
      raw() {
        return testGraph;
      },
    } as InspectableGraph;
    store.selectAll(inspectableGraph);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), full);
  });
});
