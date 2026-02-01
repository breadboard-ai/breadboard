/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { beforeEach, suite, test } from "node:test";
import { GraphController } from "../../../../../../src/sca/controller/subcontrollers/editor/graph/graph-controller.js";
import { makeTestGraphStore } from "../../../../../helpers/_graph-store.js";
import { testKit } from "../../../../../test-kit.js";
import { EditableGraph, GraphDescriptor } from "@breadboard-ai/types";
import { unwrap } from "../../../../../../src/sca/controller/decorators/utils/wrap-unwrap.js";
import { GraphStore } from "../../../../../../src/engine/inspector/graph-store.js";
import { Tab } from "../../../../../../src/runtime/types.js";

function makeFreshGraph(): GraphDescriptor {
  return {
    edges: [],
    nodes: [{ id: "foo", type: "promptTemplate" }],
  } satisfies GraphDescriptor;
}

suite("GraphController", () => {
  let testGraph = makeFreshGraph();
  let editableGraph: EditableGraph | undefined;
  let graphStore: GraphStore;

  beforeEach(() => {
    graphStore = makeTestGraphStore({
      kits: [testKit],
    });

    testGraph = makeFreshGraph();
    const mainGraphId = graphStore.addByDescriptor(testGraph);
    if (!mainGraphId.success) assert.fail("Unable to create graph");
    editableGraph = graphStore.edit(mainGraphId.result);
    if (!editableGraph) assert.fail("Unable to edit graph");
  });

  test("Takes an editor", async () => {
    const store = new GraphController("Graph_1", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");

    store.setEditor(editableGraph);
    assert.strictEqual(unwrap(store.editor), editableGraph);
  });

  test("Unhooks an existing editor", async () => {
    const store = new GraphController("Graph_2", "GraphController");
    await store.isHydrated;

    // Apply the default editor.
    if (!editableGraph) assert.fail("No editable graph");
    store.setEditor(editableGraph);

    // Make a new one and apply it.
    const newId = graphStore.addByDescriptor(makeFreshGraph());
    if (!newId.success) assert.fail("Unable to create graph");
    const editableGraphAlt = graphStore.edit(newId.result);
    if (!editableGraphAlt) assert.fail("No editable graph");

    // On changing the editor we should not get a graph change on the old
    // editor.
    editableGraph.addEventListener("graphchange", () => {
      assert.fail("Should not be used");
    });

    store.setEditor(editableGraphAlt);
    assert.strictEqual(unwrap(store.editor), editableGraphAlt);

    // Fire a change and make sure we get a new version.
    const result = await editableGraphAlt.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "foobar", type: "secrets" },
        },
      ],
      "Add node"
    );

    if (!result.success) assert.fail("Update failed");

    // The change should bump the version.
    await store.isSettled;
    assert.strictEqual(store.version, 1);
  });

  test("Tracks errors", async () => {
    const store = new GraphController("Graph_3", "GraphController");
    await store.isHydrated;

    // Apply the default editor.
    if (!editableGraph) assert.fail("No editable graph");
    store.setEditor(editableGraph);

    // foo already exists so this should fail.
    const result = await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "foo", type: "secrets" },
        },
      ],
      "Add node"
    );

    if (result.success) assert.fail("Update failed");
    await store.isSettled;
    assert.strictEqual(
      store.lastEditError,
      `Unable to add node: a node with id "foo" already exists`
    );

    // foobar does exist so this should work and reset the last error.
    const result2 = await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "foobar", type: "secrets" },
        },
      ],
      "Add node"
    );

    if (!result2.success) assert.fail("Update failed");
    await store.isSettled;
    assert.strictEqual(store.lastEditError, null);
  });

  test("provides legacy tab info (deprecated)", async () => {
    const store = new GraphController("Graph_4", "GraphController");
    await store.isHydrated;

    // Nothing set, should get a null tab
    assert.deepStrictEqual(store.asTab(), null);

    // Apply the default editor.
    if (!editableGraph) assert.fail("No editable graph");
    store.setEditor(editableGraph);

    const expected = {
      id: globalThis.crypto.randomUUID(),
      graph: editableGraph.raw(),
      graphIsMine: true,
      readOnly: false,
      boardServer: null,
      lastLoadedVersion: 20,
      mainGraphId: globalThis.crypto.randomUUID(),
      moduleId: null,
      name: "Untitled app",
      subGraphId: null,
      type: 0,
      version: 10,
      finalOutputValues: undefined,
    } satisfies Tab;

    store.id = expected.id;
    store.version = expected.version;
    store.lastLoadedVersion = expected.lastLoadedVersion;
    store.url = expected.graph.url ?? "http://example.com";
    store.readOnly = expected.readOnly;
    store.graphIsMine = expected.graphIsMine;
    store.mainGraphId = expected.mainGraphId;

    await store.isSettled;
    assert.deepStrictEqual(store.asTab(), expected);

    // Reset.
    store.resetAll();
    await store.isSettled;
    assert.deepStrictEqual(store.asTab(), null);
  });
});
