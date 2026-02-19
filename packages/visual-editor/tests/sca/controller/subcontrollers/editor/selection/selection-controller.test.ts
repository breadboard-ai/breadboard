/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { SelectionController } from "../../../../../../src/sca/controller/subcontrollers/editor/selection/selection-controller.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import { unwrap } from "../../../../../../src/sca/controller/decorators/utils/wrap-unwrap.js";
import {
  makeTestGraphStore,
  loadGraphIntoStore,
} from "../../../../../helpers/_graph-store.js";
import { toEdgeIdentifier } from "../../../../../../src/sca/utils/helpers/helpers.js";

const testGraph: GraphDescriptor & Required<Pick<GraphDescriptor, "assets">> = {
  nodes: [
    {
      id: "a",
      type: "type",
      configuration: {
        config$prompt: {
          parts: [
            {
              text: '{{"type": "asset", "path": "asset-a", "title": "Asset"}} ',
            },
          ],
          role: "user",
        },
      },
    },
    {
      id: "b",
      type: "type",
      configuration: {
        config$prompt: {
          parts: [
            {
              text: '{{"type": "asset", "path": "asset-b", "title": "Asset"}} ',
            },
          ],
          role: "user",
        },
      },
    },
  ],
  edges: [
    { from: "a", to: "a", out: "a", in: "a" },
    { from: "a", to: "b", out: "a", in: "b" },
    { from: "a", to: "b", out: "*", in: "*" },
  ],
  assets: {
    "asset-a": { data: "" },
    "asset-b": { data: "" },
  },
};

const id0 = testGraph.nodes[0].id;
const id1 = testGraph.nodes[1].id;
const edge0 = toEdgeIdentifier(testGraph.edges[0]);
const edge1 = toEdgeIdentifier(testGraph.edges[1]);
const edge2 = toEdgeIdentifier(testGraph.edges[2]);
const asset0 = Object.keys(testGraph.assets)[0];
const asset1 = Object.keys(testGraph.assets)[1];
const assetEdge0 = "asset-a->a:load";
const assetEdge1 = "asset-b->b:load";
const empty = {
  nodes: new Set(),
  edges: new Set(),
  assets: new Set(),
  assetEdges: new Set(),
};
const full = {
  nodes: new Set([id0, id1]),
  edges: new Set([edge0, edge1, edge2]),
  assets: new Set([asset0, asset1]),
  assetEdges: new Set([assetEdge0, assetEdge1]),
};

suite("SelectionController", () => {
  test("Add and remove nodes", async () => {
    const store = new SelectionController("Selection_1", "SelectionController");
    await store.isHydrated;

    store.addNode(id0);
    store.addNode(id1);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set([id0, id1]),
      edges: new Set(),
      assets: new Set(),
      assetEdges: new Set(),
    });

    store.removeNode(id0);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set([id1]),
      edges: new Set(),
      assets: new Set(),
      assetEdges: new Set(),
    });

    store.removeNodes();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Edges", async () => {
    const store = new SelectionController("Selection_2", "SelectionController");
    await store.isHydrated;

    store.addEdge(edge0);
    store.addEdge(edge1);
    store.addEdge(edge2);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set([edge0, edge1, edge2]),
      assets: new Set(),
      assetEdges: new Set(),
    });

    store.removeEdge(edge0);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set([edge1, edge2]),
      assets: new Set(),
      assetEdges: new Set(),
    });

    store.removeEdges();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Assets", async () => {
    const store = new SelectionController("Selection_3", "SelectionController");
    await store.isHydrated;

    store.addAsset(asset0);
    store.addAsset(asset1);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set(),
      assets: new Set([asset0, asset1]),
      assetEdges: new Set(),
    });

    store.removeAsset(asset0);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set(),
      assets: new Set([asset1]),
      assetEdges: new Set(),
    });

    store.removeAssets();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Asset Edges", async () => {
    const store = new SelectionController("Selection_4", "SelectionController");
    await store.isHydrated;

    store.addAssetEdge(assetEdge0);
    store.addAssetEdge(assetEdge1);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set(),
      assets: new Set(),
      assetEdges: new Set([assetEdge0, assetEdge1]),
    });

    store.removeAssetEdge(assetEdge0);
    await store.isSettled;

    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set(),
      edges: new Set(),
      assets: new Set(),
      assetEdges: new Set([assetEdge1]),
    });

    store.removeAssetEdges();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("Select All (Inspectable) & deselectAll", async () => {
    const store = new SelectionController("Selection_5", "SelectionController");
    await store.isHydrated;

    const graphStore = makeTestGraphStore();

    loadGraphIntoStore(graphStore, testGraph);
    const inspectableGraph = graphStore.get()?.graphs.get("");
    if (!inspectableGraph) assert.fail("Unable to inspect graph");

    store.selectAll(inspectableGraph);
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), full);
    assert.equal(store.size, 9);

    store.deselectAll();
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), empty);
  });

  test("selectedNodeId returns null when nothing is selected", async () => {
    const store = new SelectionController("Selection_6", "SelectionController");
    await store.isHydrated;

    assert.equal(store.selectedNodeId, null);
  });

  test("selectedNodeId returns the node when exactly one node is selected", async () => {
    const store = new SelectionController("Selection_7", "SelectionController");
    await store.isHydrated;

    store.addNode(id0);
    await store.isSettled;
    assert.equal(store.selectedNodeId, id0);
  });

  test("selectedNodeId returns null when multiple nodes are selected", async () => {
    const store = new SelectionController("Selection_8", "SelectionController");
    await store.isHydrated;

    store.addNode(id0);
    store.addNode(id1);
    await store.isSettled;
    assert.equal(store.selectedNodeId, null);
  });

  test("selectedNodeId returns null when node plus other items are selected", async () => {
    const store = new SelectionController("Selection_9", "SelectionController");
    await store.isHydrated;

    store.addNode(id0);
    store.addEdge(edge0);
    await store.isSettled;
    assert.equal(store.selectedNodeId, null);
  });

  test("selectNodes clears existing selection and selects given nodes", async () => {
    const store = new SelectionController(
      "Selection_10",
      "SelectionController"
    );
    await store.isHydrated;

    store.addEdge(edge0);
    store.addAsset(asset0);
    await store.isSettled;
    assert.equal(store.size, 2);

    store.selectNodes([id0, id1]);
    await store.isSettled;
    assert.deepStrictEqual(unwrap(store.selection), {
      nodes: new Set([id0, id1]),
      edges: new Set(),
      assets: new Set(),
      assetEdges: new Set(),
    });
  });
});
