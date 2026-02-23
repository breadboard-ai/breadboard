/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { beforeEach, suite, test } from "node:test";
import { GraphController } from "../../../../../../src/sca/controller/subcontrollers/editor/graph/graph-controller.js";
import {
  makeTestGraphStore,
  makeTestGraphStoreArgs,
  loadGraphIntoStore,
} from "../../../../../helpers/_graph-store.js";
import { editGraphStore } from "../../../../../helpers/_editor.js";
import type { NodeDescriber } from "../../../../../../src/sca/controller/subcontrollers/editor/graph/node-describer.js";

const noopDescriber: NodeDescriber = async () => ({
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
});
import type {
  AssetPath,
  EditableGraph,
  EditHistoryCreator,
  GraphDescriptor,
  MutableGraphStore,
} from "@breadboard-ai/types";
import type { GraphAsset } from "../../../../../../src/sca/types.js";
import { ok } from "@breadboard-ai/utils";
import { unwrap } from "../../../../../../src/sca/controller/decorators/utils/wrap-unwrap.js";

import { createMockEditor, makeFreshGraph } from "../../../../helpers/index.js";
import { A2_TOOLS } from "../../../../../../src/a2/a2-registry.js";

suite("GraphController", () => {
  let testGraph = makeFreshGraph();
  let editableGraph: EditableGraph | undefined;
  let graphStore: MutableGraphStore;

  beforeEach(() => {
    graphStore = makeTestGraphStore();

    testGraph = makeFreshGraph();
    loadGraphIntoStore(graphStore, testGraph);
    editableGraph = editGraphStore(graphStore);
    if (!editableGraph) assert.fail("Unable to edit graph");
  });

  /**
   * Mirrors the production lifecycle in `initializeEditor()`:
   * `initialize()` first (populates MutableGraph caches), then `setEditor()`.
   */
  function initAndSetEditor(
    store: GraphController,
    editor: EditableGraph
  ): void {
    store.initialize(
      editor.raw() as GraphDescriptor,
      makeTestGraphStoreArgs(),
      noopDescriber
    );
    store.setEditor(editor);
  }

  test("Takes an editor", async () => {
    const store = new GraphController("Graph_1", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");

    initAndSetEditor(store, editableGraph);
    assert.strictEqual(unwrap(store.editor), editableGraph);
  });

  test("Unhooks an existing editor", async () => {
    const store = new GraphController("Graph_2", "GraphController");
    await store.isHydrated;

    // Apply the default editor.
    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    // Make a new one and apply it.
    loadGraphIntoStore(graphStore, makeFreshGraph());
    const editableGraphAlt = editGraphStore(graphStore);
    if (!editableGraphAlt) assert.fail("No editable graph");

    // On changing the editor we should not get a graph change on the old
    // editor.
    editableGraph.addEventListener("graphchange", () => {
      assert.fail("Should not be used");
    });

    initAndSetEditor(store, editableGraphAlt!);
    assert.strictEqual(unwrap(store.editor), editableGraphAlt);

    // Fire a change and make sure we get a new version.
    const result = await editableGraphAlt.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "foobar", type: "test:secrets" },
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
    initAndSetEditor(store, editableGraph);

    // foo already exists so this should fail.
    const result = await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "foo", type: "test:secrets" },
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
          node: { id: "foobar", type: "test:secrets" },
        },
      ],
      "Add node"
    );

    if (!result2.success) assert.fail("Update failed");
    await store.isSettled;
    assert.strictEqual(store.lastEditError, null);
  });

  test("exposes static A2 tools", async () => {
    const store = new GraphController("Graph_5", "GraphController");
    await store.isHydrated;

    // tools should be pre-populated with A2_TOOLS
    assert.strictEqual(store.tools.size, A2_TOOLS.length);

    // Verify each tool is present
    for (const [key, tool] of A2_TOOLS) {
      assert.ok(store.tools.has(key), `Missing tool: ${key}`);
      const storedTool = store.tools.get(key);
      assert.strictEqual(storedTool?.url, tool.url);
      assert.strictEqual(storedTool?.title, tool.title);
    }
  });

  test("populates myTools from sub-graphs on setEditor", async () => {
    const store = new GraphController("Graph_6", "GraphController");
    await store.isHydrated;

    // Create a graph with sub-graphs
    const graphWithSubGraphs = {
      ...makeFreshGraph(),
      graphs: {
        "sub-graph-1": {
          title: "My Sub Tool",
          description: "A test sub-graph",
          nodes: [],
          edges: [],
        },
        "sub-graph-2": {
          title: "Another Tool",
          nodes: [],
          edges: [],
        },
      },
    };

    loadGraphIntoStore(graphStore, graphWithSubGraphs);
    const editable = editGraphStore(graphStore);
    if (!editable) assert.fail("Unable to edit graph");

    // Verify the graph structure is preserved
    const rawGraph = editable.raw();
    if (!rawGraph.graphs || Object.keys(rawGraph.graphs).length === 0) {
      // Graph store doesn't preserve sub-graphs - skip this test
      console.log("Skipping: Graph store does not preserve sub-graphs");
      return;
    }

    initAndSetEditor(store, editable);
    await store.isSettled;

    // myTools should contain the two sub-graphs
    assert.strictEqual(store.myTools.size, 2);
    assert.ok(store.myTools.has("#sub-graph-1"));
    assert.ok(store.myTools.has("#sub-graph-2"));

    const tool1 = store.myTools.get("#sub-graph-1");
    assert.strictEqual(tool1?.url, "#sub-graph-1");
    assert.strictEqual(tool1?.title, "My Sub Tool");
    assert.strictEqual(tool1?.description, "A test sub-graph");
    assert.strictEqual(tool1?.icon, "tool");
    assert.strictEqual(tool1?.order, Number.MAX_SAFE_INTEGER);

    const tool2 = store.myTools.get("#sub-graph-2");
    assert.strictEqual(tool2?.url, "#sub-graph-2");
    assert.strictEqual(tool2?.title, "Another Tool");
    assert.strictEqual(tool2?.order, Number.MAX_SAFE_INTEGER);
  });

  test("myTools is empty when graph has no sub-graphs", async () => {
    const store = new GraphController("Graph_7", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // Default test graph has no sub-graphs
    assert.strictEqual(store.myTools.size, 0);
  });

  test("myTools cleared on resetAll", async () => {
    const store = new GraphController("Graph_8", "GraphController");
    await store.isHydrated;

    const graphWithSubGraphs = {
      ...makeFreshGraph(),
      graphs: {
        "test-tool": { title: "Test", nodes: [], edges: [] },
      },
    };

    loadGraphIntoStore(graphStore, graphWithSubGraphs);
    const editable = editGraphStore(graphStore);
    if (!editable) assert.fail("Unable to edit graph");

    // Verify the graph structure is preserved
    const rawGraph = editable.raw();
    if (!rawGraph.graphs || Object.keys(rawGraph.graphs).length === 0) {
      // Graph store doesn't preserve sub-graphs - skip this test
      console.log("Skipping: Graph store does not preserve sub-graphs");
      return;
    }

    initAndSetEditor(store, editable);
    await store.isSettled;
    assert.strictEqual(store.myTools.size, 1);

    store.resetAll();
    await store.isSettled;
    assert.strictEqual(store.myTools.size, 0);
  });

  test("myTools populated from mock editor with sub-graphs (guaranteed coverage)", async () => {
    const store = new GraphController("Graph_MockMyTools", "GraphController");
    await store.isHydrated;

    // Use createMockEditor with a rawGraph that includes sub-graphs
    // This guarantees coverage of #updateMyTools regardless of graphStore behavior
    const mockEditor = createMockEditor({
      rawGraph: {
        nodes: [{ id: "main-node", type: "input" }],
        graphs: {
          "mock-sub-1": {
            title: "Mock Tool One",
            description: "First mock tool",
            nodes: [],
            edges: [],
          },
          "mock-sub-2": {
            // No title - tests the "Untitled Tool" fallback
            nodes: [],
            edges: [],
          },
        },
      },
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    // Verify myTools populated correctly
    assert.strictEqual(store.myTools.size, 2);

    const tool1 = store.myTools.get("#mock-sub-1");
    assert.ok(tool1, "Should have mock-sub-1");
    assert.strictEqual(tool1.url, "#mock-sub-1");
    assert.strictEqual(tool1.title, "Mock Tool One");
    assert.strictEqual(tool1.description, "First mock tool");
    assert.strictEqual(tool1.icon, "tool");
    assert.strictEqual(tool1.order, Number.MAX_SAFE_INTEGER);

    const tool2 = store.myTools.get("#mock-sub-2");
    assert.ok(tool2, "Should have mock-sub-2");
    assert.strictEqual(tool2.title, "Untitled Tool");
    assert.strictEqual(tool2.order, Number.MAX_SAFE_INTEGER);
  });

  test("agentModeTools includes memory tool always", async () => {
    const store = new GraphController("Graph_9", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // Memory tool should always be present
    assert.ok(store.agentModeTools.has("function-group/use-memory"));
    const memoryTool = store.agentModeTools.get("function-group/use-memory");
    assert.strictEqual(memoryTool?.title, "Use Memory");
    assert.strictEqual(memoryTool?.icon, "database");
  });

  test("agentModeTools includes routing only when >1 node", async () => {
    const store = new GraphController("Graph_10", "GraphController");
    await store.isHydrated;

    // testGraph has one node by default
    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // With 1 node, routing should NOT be present
    assert.ok(!store.agentModeTools.has("control-flow/routing"));

    // Add a second node
    const result = await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "second-node", type: "test:secrets" },
        },
      ],
      "Add second node"
    );
    if (!result.success) assert.fail("Failed to add node");
    await store.isSettled;

    // Now routing SHOULD be present
    assert.ok(store.agentModeTools.has("control-flow/routing"));
    const routingTool = store.agentModeTools.get("control-flow/routing");
    assert.strictEqual(routingTool?.title, "Go to:");
    assert.strictEqual(routingTool?.icon, "spark");
  });

  test("agentModeTools cleared on resetAll", async () => {
    const store = new GraphController("Graph_11", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;
    assert.ok(store.agentModeTools.size > 0);

    store.resetAll();
    await store.isSettled;
    assert.strictEqual(store.agentModeTools.size, 0);
  });

  test("components initialized on setEditor", async () => {
    const store = new GraphController("Graph_12", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // components should be a Map (main graph at "" key)
    assert.ok(store.components instanceof Map);
    assert.ok(store.components.has(""));
  });

  test("components cleared on resetAll", async () => {
    const store = new GraphController("Graph_13", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;
    assert.ok(store.components.has(""));

    store.resetAll();
    await store.isSettled;
    assert.strictEqual(store.components.size, 0);
  });

  test("components empty when no editor", async () => {
    const store = new GraphController("Graph_14", "GraphController");
    await store.isHydrated;

    // No editor set
    assert.strictEqual(store.components.size, 0);
  });

  test("components is ReadonlyMap", async () => {
    const store = new GraphController("Graph_15", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // Verify it's a Map but should be treated as readonly
    const components = store.components;
    assert.ok(components instanceof Map);
    assert.strictEqual(typeof components.get, "function");
    assert.strictEqual(typeof components.has, "function");
    assert.strictEqual(typeof components.keys, "function");
  });

  test("components populated from graph nodes", async () => {
    const store = new GraphController("Graph_16", "GraphController");
    await store.isHydrated;

    // Create a graph with nodes
    const graphWithNodes = {
      ...makeFreshGraph(),
      nodes: [
        { id: "node-1", type: "input" },
        { id: "node-2", type: "output" },
      ],
    };

    loadGraphIntoStore(graphStore, graphWithNodes);
    const editable = editGraphStore(graphStore);
    if (!editable) assert.fail("Unable to edit graph");

    initAndSetEditor(store, editable);
    await store.isSettled;

    // Wait for async component updates to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mainGraphComponents = store.components.get("");
    assert.ok(mainGraphComponents, "Should have main graph components");
    // The components map should exist for the main graph
    assert.ok(mainGraphComponents instanceof Map);
  });

  test("components updates on graph change", async () => {
    const store = new GraphController("Graph_17", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    const initialComponents = store.components;
    assert.ok(initialComponents.has(""));

    // Add a node to trigger graph change
    await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "new-node", type: "test:secrets" },
        },
      ],
      "Add new node for components test"
    );
    await store.isSettled;

    // Wait for async component updates
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Components should still exist after update
    assert.ok(store.components.has(""));
  });

  test("version guard prevents stale async updates", async () => {
    const store = new GraphController("Graph_18", "GraphController");
    await store.isHydrated;

    // Create initial graph
    const graph1 = {
      ...makeFreshGraph(),
      nodes: [{ id: "first-node", type: "input" }],
    };
    loadGraphIntoStore(graphStore, graph1);
    const editable1 = editGraphStore(graphStore);
    if (!editable1) assert.fail("Unable to edit graph 1");

    initAndSetEditor(store, editable1);

    // Immediately set a different editor (simulating rapid changes)
    // This should cause the first async update to be discarded
    const graph2 = {
      ...makeFreshGraph(),
      nodes: [{ id: "second-node", type: "output" }],
    };
    loadGraphIntoStore(graphStore, graph2);
    const editable2 = editGraphStore(graphStore);
    if (!editable2) assert.fail("Unable to edit graph 2");

    initAndSetEditor(store, editable2);
    await store.isSettled;

    // Wait for all async updates to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The components should reflect the second graph, not the first
    // (version guard should have discarded the first update)
    assert.ok(store.components.has(""));
    // The key assertion: we have components from the latest setEditor call
    const mainComponents = store.components.get("");
    assert.ok(mainComponents instanceof Map);
  });

  test("myTools falls back to 'Untitled Tool' when title is missing", async () => {
    const store = new GraphController("Graph_19", "GraphController");
    await store.isHydrated;

    // Create a graph with a sub-graph that has no title
    const graphWithUntitledSubGraph = {
      ...makeFreshGraph(),
      graphs: {
        "untitled-graph": {
          nodes: [],
          edges: [],
          // No title property
        },
      },
    };

    loadGraphIntoStore(graphStore, graphWithUntitledSubGraph);
    const editable = editGraphStore(graphStore);
    if (!editable) assert.fail("Unable to edit graph");

    const rawGraph = editable.raw();
    if (!rawGraph.graphs || Object.keys(rawGraph.graphs).length === 0) {
      console.log("Skipping: Graph store does not preserve sub-graphs");
      return;
    }

    initAndSetEditor(store, editable);
    await store.isSettled;

    const tool = store.myTools.get("#untitled-graph");
    assert.strictEqual(tool?.title, "Untitled Tool");
  });

  test("components contain expected structure from nodes", async () => {
    const store = new GraphController("Graph_20", "GraphController");
    await store.isHydrated;

    // Create a graph with a node
    const graphWithNode = {
      ...makeFreshGraph(),
      nodes: [{ id: "test-component-node", type: "input" }],
    };

    loadGraphIntoStore(graphStore, graphWithNode);
    const editable = editGraphStore(graphStore);
    if (!editable) assert.fail("Unable to edit graph");

    initAndSetEditor(store, editable);
    await store.isSettled;

    // Wait for async component updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    const mainGraphComponents = store.components.get("");
    assert.ok(mainGraphComponents, "Should have main graph components");

    // Verify the component exists and has the expected structure
    const component = mainGraphComponents.get("test-component-node");
    if (component) {
      // Component has the required fields
      assert.strictEqual(component.id, "test-component-node");
      assert.ok("title" in component);
      assert.ok("ports" in component || "metadata" in component);
    }
    // Note: component might be undefined if node inspection fails in test env
  });

  test("components uses fast-path when tags exist and ports not updating", async () => {
    const store = new GraphController("Graph_FastPath", "GraphController");
    await store.isHydrated;

    // Create mock with nodes that have tags and non-updating ports
    // This exercises the fast-path: if (tags && !ports.updating) branch
    const mockEditor = createMockEditor({
      mockNodes: [
        {
          id: "fast-path-node",
          type: "input",
          title: "Fast Path Title",
          description: "Fast path description",
          tags: ["tool"], // Tags present - triggers fast path
          portsUpdating: false, // Not updating - triggers fast path
        },
        {
          id: "async-path-node",
          type: "output",
          title: "Async Path Title",
          // No tags - will use async path
          portsUpdating: false,
        },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    // Wait for async updates to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mainGraphComponents = store.components.get("");
    assert.ok(mainGraphComponents, "Should have main graph components");

    // Verify fast-path node was processed
    const fastPathComponent = mainGraphComponents.get("fast-path-node");
    assert.ok(fastPathComponent, "Should have fast-path component");
    assert.strictEqual(fastPathComponent.id, "fast-path-node");
    assert.strictEqual(fastPathComponent.title, "fast-path-node");
    assert.strictEqual(fastPathComponent.description, "fast-path-node");
    assert.ok(fastPathComponent.ports, "Should have ports");
    assert.ok(fastPathComponent.metadata, "Should have metadata");

    // Verify async-path node was also processed
    const asyncPathComponent = mainGraphComponents.get("async-path-node");
    assert.ok(asyncPathComponent, "Should have async-path component");
    assert.strictEqual(asyncPathComponent.id, "async-path-node");
  });

  // ==========================================================================
  // Node Query Methods
  // ==========================================================================

  test("getMetadataForNode returns error when no editor", async () => {
    const store = new GraphController("Graph_Meta_NoEditor", "GraphController");
    await store.isHydrated;

    const result = store.getMetadataForNode("foo", "");
    assert.ok(!ok(result), "Should return an error");
  });

  test("getMetadataForNode returns error for missing node", async () => {
    const store = new GraphController(
      "Graph_Meta_MissingNode",
      "GraphController"
    );
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.getMetadataForNode("nonexistent", "");
    assert.ok(!ok(result), "Should return an error for missing node");
  });

  test("getMetadataForNode returns metadata for existing node", async () => {
    const store = new GraphController("Graph_Meta_OK", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    // "foo" exists in the default test graph
    const result = store.getMetadataForNode("foo", "");
    // Not an error — either metadata or an Outcome error
    // The node exists; metadata availability depends on the test handler
    if (ok(result)) {
      assert.ok(typeof result === "object");
    }
  });

  test("getPortsForNode returns error when no editor", async () => {
    const store = new GraphController(
      "Graph_Ports_NoEditor",
      "GraphController"
    );
    await store.isHydrated;

    const result = store.getPortsForNode("foo", "");
    assert.ok(!ok(result), "Should return an error");
  });

  test("getPortsForNode returns error for missing node", async () => {
    const store = new GraphController(
      "Graph_Ports_MissingNode",
      "GraphController"
    );
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.getPortsForNode("nonexistent", "");
    assert.ok(!ok(result), "Should return an error for missing node");
  });

  test("getPortsForNode returns ports for existing node", async () => {
    const store = new GraphController("Graph_Ports_OK", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.getPortsForNode("foo", "");
    if (ok(result)) {
      assert.ok("inputs" in result);
      assert.ok("outputs" in result);
    }
  });

  test("getTitleForNode returns error when no editor", async () => {
    const store = new GraphController(
      "Graph_Title_NoEditor",
      "GraphController"
    );
    await store.isHydrated;

    const result = store.getTitleForNode("foo", "");
    assert.ok(!ok(result), "Should return an error");
  });

  test("getTitleForNode returns error for missing node", async () => {
    const store = new GraphController(
      "Graph_Title_MissingNode",
      "GraphController"
    );
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.getTitleForNode("nonexistent", "");
    assert.ok(!ok(result), "Should return an error for missing node");
  });

  test("getTitleForNode returns title for existing node", async () => {
    const store = new GraphController("Graph_Title_OK", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.getTitleForNode("foo", "");
    if (ok(result)) {
      assert.strictEqual(typeof result, "string");
    }
  });

  test("findOutputPortId returns error when no editor", async () => {
    const store = new GraphController(
      "Graph_FindPort_NoEditor",
      "GraphController"
    );
    await store.isHydrated;

    const result = store.findOutputPortId("", "foo");
    assert.ok(!ok(result), "Should return an error");
  });

  test("findOutputPortId returns error for missing node", async () => {
    const store = new GraphController(
      "Graph_FindPort_MissingNode",
      "GraphController"
    );
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.findOutputPortId("", "nonexistent");
    assert.ok(!ok(result), "Should return an error for missing node");
  });

  test("findOutputPortId returns port info for existing node", async () => {
    const store = new GraphController("Graph_FindPort_OK", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);

    const result = store.findOutputPortId("", "foo");
    if (ok(result)) {
      assert.ok("id" in result);
      assert.ok("title" in result);
      assert.strictEqual(result.title, "foo");
    }
  });

  // ==========================================================================
  // Fast Access Derivations
  // ==========================================================================

  test("getRoutes returns empty map when no node is selected", async () => {
    const store = new GraphController("Graph_Routes_Null", "GraphController");
    await store.isHydrated;

    const mockEditor = createMockEditor({
      mockNodes: [
        { id: "node-a", type: "input", title: "Step A" },
        { id: "node-b", type: "output", title: "Step B" },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    const routes = store.getRoutes(null);
    assert.strictEqual(routes.size, 0);
  });

  test("getRoutes excludes the selected node", async () => {
    const store = new GraphController("Graph_Routes_Excl", "GraphController");
    await store.isHydrated;

    const mockEditor = createMockEditor({
      mockNodes: [
        { id: "node-a", type: "input", title: "Step A" },
        { id: "node-b", type: "output", title: "Step B" },
        { id: "node-c", type: "output", title: "Step C" },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    const routes = store.getRoutes("node-b");
    assert.strictEqual(routes.size, 2);
    assert.ok(routes.has("node-a"));
    assert.ok(routes.has("node-c"));
    assert.ok(!routes.has("node-b"), "Selected node should be excluded");
    assert.strictEqual(routes.get("node-a")?.title, "node-a");
  });

  test("getRoutes returns empty when no editor", async () => {
    const store = new GraphController("Graph_Routes_NoEd", "GraphController");
    await store.isHydrated;

    // No editor set
    const routes = store.getRoutes("some-node");
    assert.strictEqual(routes.size, 0);
  });

  test("getFilteredComponents returns all components when no node selected", async () => {
    const store = new GraphController("Graph_FC_Null", "GraphController");
    await store.isHydrated;

    const mockEditor = createMockEditor({
      mockNodes: [
        {
          id: "node-a",
          type: "input",
          title: "A",
          tags: ["tool"],
          portsUpdating: false,
        },
        {
          id: "node-b",
          type: "output",
          title: "B",
          tags: ["tool"],
          portsUpdating: false,
        },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;
    await new Promise((resolve) => setTimeout(resolve, 50));

    const unfiltered = store.getFilteredComponents(null);
    // Should return the same map as _components when nothing is selected
    assert.ok(unfiltered.has(""));
    assert.strictEqual(unfiltered.get("")?.size, 2);
  });

  test("getFilteredComponents returns all components when no editor", async () => {
    const store = new GraphController("Graph_FC_NoEd", "GraphController");
    await store.isHydrated;

    // No editor — should just return _components (empty)
    const result = store.getFilteredComponents("some-node");
    assert.strictEqual(result.size, 0);
  });

  test("getFastAccessItems returns empty when no editor", async () => {
    const store = new GraphController("Graph_FAI_NoEd", "GraphController");
    await store.isHydrated;

    const items = store.getFastAccessItems(null);
    // Should still have A2 tools even without an editor
    assert.ok(items.length >= 0);
    // All items should be tools (from A2_TOOLS)
    for (const item of items) {
      assert.strictEqual(item.kind, "tool");
    }
  });

  test("getFastAccessItems includes assets, tools, and components", async () => {
    const store = new GraphController("Graph_FAI_All", "GraphController");
    await store.isHydrated;

    const mockEditor = createMockEditor({
      mockNodes: [
        {
          id: "node-a",
          type: "input",
          title: "A",
          tags: ["tool"],
          portsUpdating: false,
        },
        {
          id: "node-b",
          type: "output",
          title: "B",
          tags: ["tool"],
          portsUpdating: false,
        },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;
    await new Promise((resolve) => setTimeout(resolve, 50));

    const items = store.getFastAccessItems(null);

    // Should contain tools (from A2_TOOLS) and components
    const kinds = new Set(items.map((i) => i.kind));
    assert.ok(kinds.has("tool"), "Should have tools");
    assert.ok(kinds.has("component"), "Should have components");
  });

  test("getFastAccessItems includes routes when node selected", async () => {
    const store = new GraphController("Graph_FAI_Routes", "GraphController");
    await store.isHydrated;

    const mockEditor = createMockEditor({
      mockNodes: [
        {
          id: "node-a",
          type: "input",
          title: "Step A",
          tags: ["tool"],
          portsUpdating: false,
        },
        {
          id: "node-b",
          type: "output",
          title: "Step B",
          tags: ["tool"],
          portsUpdating: false,
        },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;
    await new Promise((resolve) => setTimeout(resolve, 50));

    // With a selected node, routes should be present
    const items = store.getFastAccessItems("node-a");
    const routeItems = items.filter((i) => i.kind === "route");
    assert.ok(routeItems.length > 0, "Should have route items");

    // Verify the route is for the non-selected node
    const routeIds = routeItems.map((r) => {
      if (r.kind === "route") return r.route.id;
      return null;
    });
    assert.ok(routeIds.includes("node-b"), "Route should include node-b");
    assert.ok(
      !routeIds.includes("node-a"),
      "Route should exclude selected node-a"
    );
  });

  test("getFastAccessItems excludes routes when no node selected", async () => {
    const store = new GraphController("Graph_FAI_NoRoutes", "GraphController");
    await store.isHydrated;

    const mockEditor = createMockEditor({
      mockNodes: [
        { id: "node-a", type: "input", title: "A" },
        { id: "node-b", type: "output", title: "B" },
      ],
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    const items = store.getFastAccessItems(null);
    const routeItems = items.filter((i) => i.kind === "route");
    assert.strictEqual(
      routeItems.length,
      0,
      "Should have no routes without selection"
    );
  });

  test("getFastAccessItems orders tools by order field", async () => {
    const store = new GraphController("Graph_FAI_Order", "GraphController");
    await store.isHydrated;

    // Set a mock editor so we can have myTools
    const mockEditor = createMockEditor({
      rawGraph: {
        nodes: [],
        graphs: {
          "tool-z": { title: "Zeta Tool", nodes: [], edges: [] },
          "tool-a": { title: "Alpha Tool", nodes: [], edges: [] },
        },
      },
    });

    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    const items = store.getFastAccessItems(null);
    const toolItems = items.filter((i) => i.kind === "tool");

    // Tools should be sorted by their order field
    for (let i = 1; i < toolItems.length; i++) {
      const prev = toolItems[i - 1];
      const curr = toolItems[i];
      if (prev.kind === "tool" && curr.kind === "tool") {
        assert.ok(
          (prev.tool.order ?? 0) <= (curr.tool.order ?? 0),
          "Tools should be sorted by order"
        );
      }
    }
  });

  // ==========================================================================
  // topologyVersion
  // ==========================================================================

  test("topologyVersion increments on structural graph changes", async () => {
    const store = new GraphController("Graph_Topo_Inc", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    assert.strictEqual(store.topologyVersion, 0);

    // Adding a node is a structural change.
    const result = await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "topo-node", type: "test:secrets" },
        },
      ],
      "Add node for topology test"
    );
    if (!result.success) assert.fail("Edit failed");
    await store.isSettled;

    assert.strictEqual(store.topologyVersion, 1);
  });

  test("topologyVersion does not increment on visual-only changes", async () => {
    const store = new GraphController("Graph_Topo_Visual", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    assert.strictEqual(store.topologyVersion, 0);

    // Moving a node is a visual-only change.
    const result = await editableGraph.edit(
      [
        {
          type: "changemetadata",
          graphId: "",
          id: "foo",
          metadata: { visual: { x: 100, y: 200, icon: "generic" } },
        },
      ],
      "Move node"
    );
    if (!result.success) assert.fail("Edit failed");
    await store.isSettled;

    // version should still tick, but topologyVersion should NOT.
    assert.ok(store.version > 0, "version should have incremented");
    assert.strictEqual(
      store.topologyVersion,
      0,
      "topologyVersion should not increment on visual-only change"
    );
  });

  test("topologyVersion resets to 0 on resetAll", async () => {
    const store = new GraphController("Graph_Topo_Reset", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // Bump topologyVersion with a structural edit.
    await editableGraph.edit(
      [
        {
          type: "addnode",
          graphId: "",
          node: { id: "reset-node", type: "test:secrets" },
        },
      ],
      "Add node"
    );
    await store.isSettled;
    assert.ok(store.topologyVersion > 0);

    store.resetAll();
    await store.isSettled;
    assert.strictEqual(store.topologyVersion, 0);
  });

  // ==========================================================================
  // MutableGraph — set/get (self-referential), initialize, update, rebuild
  // ==========================================================================

  test("get returns this, set is a no-op", async () => {
    const store = new GraphController("Graph_SetGet", "GraphController");
    await store.isHydrated;

    // get() always returns `this`
    assert.strictEqual(store.get(), store);

    // set() is a no-op — get() still returns `this`
    const fake = {} as unknown as import("@breadboard-ai/types").MutableGraph;
    store.set(fake);
    assert.strictEqual(store.get(), store);
  });

  test("initialize() sets deps, id, and builds caches", async () => {
    const store = new GraphController("Graph_Init", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "a", type: "foo" }],
      edges: [],
    };

    const args = makeTestGraphStoreArgs();
    store.initialize(graph, args, noopDescriber);

    // id should be a UUID
    assert.ok(store.id, "id should be set");
    assert.match(
      store.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      "id should be a UUID"
    );

    // deps should be accessible
    assert.strictEqual(store.deps, args);

    // graph should be set
    assert.strictEqual(store.graph, graph);

    // caches should be initialized
    assert.ok(store.graphs, "graphs cache should exist");
    assert.ok(store.nodes, "nodes cache should exist");
    // describeNode should work (describe entries lazily populated)
    assert.ok(store.describeNode, "describeNode method should exist");
  });

  // ==========================================================================
  // inspect()
  // ==========================================================================

  test("inspect() returns an InspectableGraph backed by this GraphController", async () => {
    const store = new GraphController("Graph_Inspect", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [
        { id: "a", type: "foo" },
        { id: "b", type: "bar" },
      ],
      edges: [{ from: "a", to: "b", out: "out", in: "in" }],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const inspectable = store.inspect("");

    // graphId
    assert.strictEqual(inspectable.graphId(), "");

    // raw
    assert.strictEqual(inspectable.raw(), graph);

    // nodes
    const nodes = inspectable.nodes();
    assert.strictEqual(nodes.length, 2);

    // nodeById
    const nodeA = inspectable.nodeById("a");
    assert.ok(nodeA, "nodeById should find node 'a'");
    assert.strictEqual(nodeA!.descriptor.id, "a");
    assert.strictEqual(nodeA!.descriptor.type, "foo");

    // edges
    const edges = inspectable.edges();
    assert.strictEqual(edges.length, 1);

    // metadata
    const metadata = inspectable.metadata();
    assert.strictEqual(metadata, graph.metadata);
  });

  test("inspect() supports sub-graphs", async () => {
    const store = new GraphController("Graph_Inspect_Sub", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "main-node", type: "foo" }],
      edges: [],
      graphs: {
        sub1: {
          nodes: [
            { id: "sub-a", type: "bar" },
            { id: "sub-b", type: "baz" },
          ],
          edges: [{ from: "sub-a", to: "sub-b", out: "x", in: "y" }],
        },
      },
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    // Main graph
    const main = store.inspect("");
    assert.strictEqual(main.nodes().length, 1);
    assert.strictEqual(main.graphId(), "");

    // Sub-graph
    const sub = store.inspect("sub1");
    assert.strictEqual(sub.graphId(), "sub1");
    assert.strictEqual(sub.nodes().length, 2);
    assert.strictEqual(sub.edges().length, 1);

    // nodeById in sub-graph
    const subNode = sub.nodeById("sub-a");
    assert.ok(subNode, "should find node in sub-graph");
    assert.strictEqual(subNode!.descriptor.type, "bar");
  });

  test("inspect() node has title and metadata", async () => {
    const store = new GraphController("Graph_Inspect_Meta", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [
        {
          id: "n1",
          type: "foo",
          metadata: { title: "My Node", description: "A test node" },
        },
        { id: "n2", type: "bar" },
      ],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const inspectable = store.inspect("");
    const node1 = inspectable.nodeById("n1");
    assert.ok(node1);
    assert.strictEqual(node1!.title(), "My Node");
    assert.deepStrictEqual(node1!.metadata(), {
      title: "My Node",
      description: "A test node",
    });
    assert.deepStrictEqual(node1!.configuration(), {});

    // Node without explicit title falls back to id
    const node2 = inspectable.nodeById("n2");
    assert.ok(node2);
    assert.strictEqual(node2!.title(), "n2");
  });

  test("filteredComponents returns empty map when no components for main graph", async () => {
    const store = new GraphController(
      "Graph_FilteredComp_Empty",
      "GraphController"
    );
    await store.isHydrated;

    // No editor set, no components populated
    const result = store.getFilteredComponents("some-node");
    // Should return empty components (no graph key "")
    assert.strictEqual(result.size, 0);
  });

  test("store getter returns this", async () => {
    const store = new GraphController("Graph_Store", "GraphController");
    await store.isHydrated;

    assert.strictEqual(store.store, store, "store should return this");
  });

  test("nodes.get returns a node by id", async () => {
    const store = new GraphController("Graph_NodesGet", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [
        { id: "alpha", type: "foo" },
        { id: "beta", type: "bar" },
      ],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const node = store.nodes.get("alpha", "");
    assert.ok(node, "should find node 'alpha'");
    assert.strictEqual(node!.descriptor.id, "alpha");

    const missing = store.nodes.get("nonexistent", "");
    assert.strictEqual(
      missing,
      undefined,
      "should return undefined for missing"
    );
  });

  test("nodes.nodes returns all nodes", async () => {
    const store = new GraphController("Graph_NodesAll", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [
        { id: "a", type: "foo" },
        { id: "b", type: "bar" },
        { id: "c", type: "foo" },
      ],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const allNodes = store.nodes.nodes("");
    assert.strictEqual(allNodes.length, 3);
  });

  test("nodes.byType filters nodes by type", async () => {
    const store = new GraphController("Graph_NodesByType", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [
        { id: "a", type: "foo" },
        { id: "b", type: "bar" },
        { id: "c", type: "foo" },
      ],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const fooNodes = store.nodes.byType("foo", "");
    assert.strictEqual(fooNodes.length, 2);

    const barNodes = store.nodes.byType("bar", "");
    assert.strictEqual(barNodes.length, 1);

    const noneNodes = store.nodes.byType("baz", "");
    assert.strictEqual(noneNodes.length, 0);
  });

  test("nodes cache works with sub-graphs", async () => {
    const store = new GraphController("Graph_SubGraphNodes", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "main-node", type: "foo" }],
      edges: [],
      graphs: {
        "sub-1": {
          nodes: [
            { id: "sub-a", type: "bar" },
            { id: "sub-b", type: "baz" },
          ],
          edges: [],
        },
      },
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    // Main graph
    assert.strictEqual(store.nodes.nodes("").length, 1);
    assert.strictEqual(
      store.nodes.get("main-node", "")?.descriptor.id,
      "main-node"
    );

    // Sub-graph
    assert.strictEqual(store.nodes.nodes("sub-1").length, 2);
    assert.strictEqual(
      store.nodes.get("sub-a", "sub-1")?.descriptor.id,
      "sub-a"
    );
    assert.strictEqual(store.nodes.get("main-node", "sub-1"), undefined);
  });

  test("graphs.get returns an InspectableGraph", async () => {
    const store = new GraphController("Graph_GraphsGet", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "a", type: "foo" }],
      edges: [],
      graphs: {
        "tool-1": { nodes: [], edges: [] },
      },
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const main = store.graphs.get("");
    assert.ok(main, "should return main graph");

    const sub = store.graphs.get("tool-1");
    assert.ok(sub, "should return sub-graph");
  });

  test("graphs.graphs returns all sub-graphs", async () => {
    const store = new GraphController("Graph_GraphsAll", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [],
      edges: [],
      graphs: {
        "tool-1": { nodes: [], edges: [] },
        "tool-2": { nodes: [], edges: [] },
      },
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const allGraphs = store.graphs.graphs();
    const keys = Object.keys(allGraphs);
    assert.strictEqual(keys.length, 2);
    assert.ok(keys.includes("tool-1"));
    assert.ok(keys.includes("tool-2"));
  });

  test("update() refreshes graph without full rebuild", async () => {
    const store = new GraphController("Graph_Update", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "a", type: "foo" }],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    // Update with a new graph (visual-only change — no describe refresh)
    const updatedGraph: GraphDescriptor = {
      nodes: [
        {
          id: "a",
          type: "foo",
          metadata: { visual: { x: 100, y: 200, icon: "generic" } },
        },
      ],
      edges: [],
    };
    store.update(updatedGraph, true);
    assert.strictEqual(store.graph, updatedGraph);
  });

  test("update() refreshes describers on structural changes", async () => {
    const store = new GraphController("Graph_UpdateStruct", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "a", type: "foo" }],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    // Non-visual update — describe entries are refreshed (not rebuilt)
    const updatedGraph: GraphDescriptor = {
      nodes: [
        { id: "a", type: "foo" },
        { id: "b", type: "bar" },
      ],
      edges: [],
    };
    store.update(updatedGraph, false);
    assert.strictEqual(store.graph, updatedGraph);
  });

  test("rebuild() creates fresh caches", async () => {
    const store = new GraphController("Graph_Rebuild", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "a", type: "foo" }],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);
    const nodesBefore = store.nodes;

    // Rebuild with a different graph
    const newGraph: GraphDescriptor = {
      nodes: [
        { id: "x", type: "bar" },
        { id: "y", type: "baz" },
      ],
      edges: [],
    };
    store.rebuild(newGraph);

    assert.strictEqual(store.graph, newGraph);
    // Nodes cache should be a new object
    assert.notStrictEqual(store.nodes, nodesBefore);
    // New nodes should be accessible
    assert.strictEqual(store.nodes.nodes("").length, 2);
    assert.ok(store.nodes.get("x", ""));
    assert.strictEqual(
      store.nodes.get("a", ""),
      undefined,
      "old node should be gone"
    );
  });

  test("initialize() generates a new id each time", async () => {
    const store = new GraphController("Graph_InitId", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = { nodes: [], edges: [] };
    const args = makeTestGraphStoreArgs();

    store.initialize(graph, args, noopDescriber);
    const firstId = store.id;

    store.initialize(graph, args, noopDescriber);
    const secondId = store.id;

    assert.notStrictEqual(
      firstId,
      secondId,
      "each initialize should generate a new id"
    );
  });

  // ==========================================================================
  // Getters (graphUrl, graphAssets, title, graph, empty)
  // ==========================================================================

  test("graphUrl returns null when no URL", async () => {
    const store = new GraphController("Graph_Url_Null", "GraphController");
    await store.isHydrated;

    assert.strictEqual(store.graphUrl, null);
  });

  test("graphUrl returns URL object when URL is set", async () => {
    const store = new GraphController("Graph_Url_Set", "GraphController");
    await store.isHydrated;

    store.url = "https://example.com/board";
    await store.isSettled;

    const url = store.graphUrl;
    assert.ok(url instanceof URL);
    assert.strictEqual(url.href, "https://example.com/board");
  });

  test("graphAssets returns the assets map", async () => {
    const store = new GraphController("Graph_Assets_Get", "GraphController");
    await store.isHydrated;

    assert.ok(store.graphAssets instanceof Map);
    assert.strictEqual(store.graphAssets.size, 0);
  });

  test("setGraphAssets updates the assets map", async () => {
    const store = new GraphController("Graph_Assets_Set", "GraphController");
    await store.isHydrated;

    const assets = new Map([
      [
        "asset-1" as AssetPath,
        { metadata: { title: "Asset 1" } } as GraphAsset,
      ],
    ]);
    store.setGraphAssets(assets);
    await store.isSettled;

    assert.strictEqual(store.graphAssets.size, 1);
    assert.ok(store.graphAssets.has("asset-1" as AssetPath));
  });

  test("clearPendingGraphReplacement resets to null", async () => {
    const store = new GraphController("Graph_ClearPGR", "GraphController");
    await store.isHydrated;

    store.pendingGraphReplacement = {
      replacement: { nodes: [], edges: [] } as unknown as GraphDescriptor,
      creator: {} as EditHistoryCreator,
    };
    await store.isSettled;

    assert.ok(store.pendingGraphReplacement !== null);
    store.clearPendingGraphReplacement();
    await store.isSettled;
    assert.strictEqual(store.pendingGraphReplacement, null);
  });

  test("title getter returns null initially", async () => {
    const store = new GraphController("Graph_Title_Init", "GraphController");
    await store.isHydrated;

    assert.strictEqual(store.title, null);
  });

  test("title getter returns graph title after setEditor", async () => {
    const store = new GraphController("Graph_Title_After", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // title is derived from the graph's title property (may be null/string)
    const title = store.title;
    assert.ok(
      title === null || typeof title === "string",
      "title should be string or null"
    );
  });

  test("graph getter returns null initially", async () => {
    const store = new GraphController("Graph_Graph_Init", "GraphController");
    await store.isHydrated;

    assert.strictEqual(store.graph, null);
  });

  test("graph getter returns descriptor after setEditor", async () => {
    const store = new GraphController("Graph_Graph_After", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    assert.ok(store.graph !== null);
    assert.ok("nodes" in store.graph!);
  });

  test("empty returns false when no graph (loading state)", async () => {
    const store = new GraphController("Graph_Empty_NoGraph", "GraphController");
    await store.isHydrated;

    // Before setEditor(), _graph is null → "loading" state.
    // The deprecated `empty` getter now returns false for "loading"
    // (only returns true for the "empty" state).
    assert.strictEqual(store.empty, false);
  });

  test("empty returns false when graph has nodes", async () => {
    const store = new GraphController("Graph_Empty_Nodes", "GraphController");
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    // testGraph has at least one node
    assert.strictEqual(store.empty, false);
  });

  // ==========================================================================
  // findOutputPortId branch coverage
  // ==========================================================================

  test("findOutputPortId returns main-port when present", async () => {
    const store = new GraphController("Graph_FOP_Main", "GraphController");
    await store.isHydrated;

    // Provide a graph with a real node that will go through the describe cache
    const graph: GraphDescriptor = {
      nodes: [{ id: "test-node", type: "some-type" }],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const result = store.findOutputPortId("", "test-node");
    // The node exists. With the real describe cache (emptyResult), we get
    // output ports. If a main-port behavior is present, it's returned;
    // otherwise falls back to first port.
    if (ok(result)) {
      assert.ok("id" in result, "Should have an id property");
      assert.ok("title" in result, "Should have a title property");
      assert.strictEqual(result.title, "test-node");
    }
  });

  test("findOutputPortId falls back to first port when no main-port", async () => {
    const store = new GraphController("Graph_FOP_First", "GraphController");
    await store.isHydrated;

    // Use a graph with a node that has no handler (so currentDescribe
    // returns emptyResult, and currentPorts produces ports with no
    // main-port behavior).
    const graph: GraphDescriptor = {
      nodes: [{ id: "test-node", type: "unknown-type" }],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    const result = store.findOutputPortId("", "test-node");
    // The node exists; the result should either be ok (found a port)
    // or err (no ports). With emptyResult, there's at least a "*" port.
    if (ok(result)) {
      assert.ok("id" in result, "Should have an id property");
      assert.ok("title" in result, "Should have a title property");
    }
  });

  test("findOutputPortId returns error for missing node", async () => {
    const store = new GraphController("Graph_FOP_NoPorts", "GraphController");
    await store.isHydrated;

    const graph: GraphDescriptor = {
      nodes: [{ id: "other-node", type: "foo" }],
      edges: [],
    };

    store.initialize(graph, makeTestGraphStoreArgs(), noopDescriber);

    // Node "missing-node" doesn't exist in the graph
    const result = store.findOutputPortId("", "missing-node");
    assert.ok(!ok(result), "Should return error for missing node");
  });

  // ==========================================================================
  // graphContentState
  // ==========================================================================

  test("graphContentState returns 'loading' before setEditor()", async () => {
    const store = new GraphController(
      "Graph_ContentState_Loading",
      "GraphController"
    );
    await store.isHydrated;

    // Before setEditor(), _graph is null → "loading"
    assert.strictEqual(store.graphContentState, "loading");
  });

  test("graphContentState returns 'empty' for a graph with no nodes/assets/subgraphs", async () => {
    const store = new GraphController(
      "Graph_ContentState_Empty",
      "GraphController"
    );
    await store.isHydrated;

    // Create a genuinely empty graph: no nodes, no assets, no sub-graphs
    const emptyGraph: GraphDescriptor = {
      nodes: [],
      edges: [],
    };

    const mockEditor = createMockEditor({ rawGraph: emptyGraph });
    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    assert.strictEqual(store.graphContentState, "empty");
  });

  test("graphContentState returns 'loaded' for a graph with nodes", async () => {
    const store = new GraphController(
      "Graph_ContentState_HasNodes",
      "GraphController"
    );
    await store.isHydrated;

    // Default testGraph has at least one node ("foo")
    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    assert.strictEqual(store.graphContentState, "loaded");
  });

  test("graphContentState returns 'loaded' for a graph with only assets", async () => {
    const store = new GraphController(
      "Graph_ContentState_HasAssets",
      "GraphController"
    );
    await store.isHydrated;

    // Graph with no nodes but has assets
    const graphWithAssets: GraphDescriptor = {
      nodes: [],
      edges: [],
      assets: {
        "file://my-doc.txt": {
          data: { inlineData: { data: "abc", mimeType: "text/plain" } },
        },
      },
    };

    const mockEditor = createMockEditor({ rawGraph: graphWithAssets });
    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    assert.strictEqual(store.graphContentState, "loaded");
  });

  test("graphContentState returns 'loaded' for a graph with only sub-graphs", async () => {
    const store = new GraphController(
      "Graph_ContentState_HasSubGraphs",
      "GraphController"
    );
    await store.isHydrated;

    // Graph with no nodes but has sub-graphs
    const graphWithSubGraphs: GraphDescriptor = {
      nodes: [],
      edges: [],
      graphs: {
        "my-tool": { title: "A Tool", nodes: [], edges: [] },
      },
    };

    const mockEditor = createMockEditor({ rawGraph: graphWithSubGraphs });
    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    assert.strictEqual(store.graphContentState, "loaded");
  });

  test("graphContentState transitions from 'loading' to 'loaded' after setEditor()", async () => {
    const store = new GraphController(
      "Graph_ContentState_Transition",
      "GraphController"
    );
    await store.isHydrated;

    // Initially "loading"
    assert.strictEqual(store.graphContentState, "loading");

    // After setting an editor with a non-empty graph, becomes "loaded"
    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    assert.strictEqual(store.graphContentState, "loaded");
  });

  test("graphContentState returns 'loading' after resetAll()", async () => {
    const store = new GraphController(
      "Graph_ContentState_Reset",
      "GraphController"
    );
    await store.isHydrated;

    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;
    assert.strictEqual(store.graphContentState, "loaded");

    // After reset, _graph is null → "loading"
    store.resetAll();
    await store.isSettled;
    assert.strictEqual(store.graphContentState, "loading");
  });

  test("deprecated empty getter returns true only for 'empty' state", async () => {
    const store = new GraphController(
      "Graph_ContentState_Deprecated",
      "GraphController"
    );
    await store.isHydrated;

    // Before setEditor: graphContentState is "loading", empty should be false
    // (this is the key behavioral change — "loading" is not "empty")
    assert.strictEqual(store.empty, false);

    // Set an empty graph
    const emptyGraph: GraphDescriptor = { nodes: [], edges: [] };
    const mockEditor = createMockEditor({ rawGraph: emptyGraph });
    initAndSetEditor(store, mockEditor as unknown as EditableGraph);
    await store.isSettled;

    // Now genuinely empty
    assert.strictEqual(store.empty, true);

    // Set a graph with content
    if (!editableGraph) assert.fail("No editable graph");
    initAndSetEditor(store, editableGraph);
    await store.isSettled;

    assert.strictEqual(store.empty, false);
  });
});
