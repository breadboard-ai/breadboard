/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { beforeEach, suite, test } from "node:test";
import * as Graph from "../../../../src/sca/actions/graph/graph-actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { AppController } from "../../../../src/sca/controller/controller.js";
import { makeTestGraphStore } from "../../../helpers/_graph-store.js";
import { testKit } from "../../../test-kit.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import type { ConfigChangeContext } from "../../../../src/sca/controller/subcontrollers/editor/graph/graph-controller.js";

function makeFreshGraph(): GraphDescriptor {
  return {
    edges: [],
    nodes: [
      { id: "foo", type: "promptTemplate" },
      { id: "bar", type: "promptTemplate" },
    ],
  } satisfies GraphDescriptor;
}

function editorChange(graphActions: typeof Graph) {
  return new Promise<GraphDescriptor>((res) => {
    graphActions.bind.controller.editor.graph.editor?.addEventListener(
      "graphchange",
      (evt) => res(evt.graph),
      { once: true }
    );
  });
}

suite("Graph Actions", () => {
  suite("instantiated without editor", () => {
    const graphActions = Graph;

    beforeEach(() => {
      const graphStore = makeTestGraphStore({
        kits: [testKit],
      });

      graphActions.bind({
        services: { graphStore } as unknown as AppServices,
        controller: {
          editor: {
            graph: {
              editor: null,
            },
          },
        } as AppController,
      });
    });

    test("throw on edit", async () => {
      await assert.rejects(async () => {
        await graphActions.updateBoardTitleAndDescription(
          "New Title",
          "New Description"
        );
      }, new Error("No active graph to edit"));
    });

    test("throw on apply", async () => {
      await assert.rejects(async () => {
        await graphActions.changeEdge("move", { from: "foo", to: "bar" });
      }, new Error("No active graph to transform"));
    });
  });

  suite("properly instantiated", () => {
    const graphActions = Graph;
    let testGraph = makeFreshGraph();

    beforeEach(() => {
      const graphStore = makeTestGraphStore({
        kits: [testKit],
      });

      testGraph = makeFreshGraph();
      const mainGraphId = graphStore.addByDescriptor(testGraph);
      if (!mainGraphId.success) assert.fail("Unable to create graph");
      const editor = graphStore.edit(mainGraphId.result);
      if (!editor) assert.fail("Unable to edit graph");

      graphActions.bind({
        services: { graphStore } as unknown as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              lastNodeConfigChange: null,
            },
          },
        } as AppController,
      });
    });

    test("throws when transforms fail", async () => {
      await assert.rejects(async () => {
        await graphActions.changeEdge(
          "remove",
          // Unknown type: foo so bar does not get added.
          { from: "foo", to: "bar", in: "*", out: "*" }
        );
      }, new Error(`Edge from "foo:*" to "bar:*" does not exist`));
    });

    suite("functionality", () => {
      test("Update title & description", async () => {
        await graphActions.updateBoardTitleAndDescription(
          "New Title",
          "New Description"
        );

        assert.strictEqual(testGraph.title, "New Title");
        assert.strictEqual(testGraph.description, "New Description");
      });

      test("Change Edge", async () => {
        assert.strictEqual(testGraph.edges.length, 0);

        await graphActions.changeEdge("add", {
          from: "foo",
          to: "bar",
          in: "*",
          out: "*",
        });

        assert.strictEqual(testGraph.edges.length, 1);

        await graphActions.changeEdge("remove", {
          from: "foo",
          to: "bar",
          in: "*",
          out: "*",
        });

        assert.strictEqual(testGraph.edges.length, 0);
      });

      test("undo & redo", async () => {
        // Should not fail, even though there is no change to the graph.
        await assert.doesNotReject(async () => {
          await graphActions.redo();
          await graphActions.undo();
        });

        await graphActions.changeEdge("add", {
          from: "foo",
          to: "bar",
          in: "*",
          out: "*",
        });

        assert.strictEqual(testGraph.nodes.length, 2);
        assert.strictEqual(testGraph.edges.length, 1);

        const changeWatcher = editorChange(graphActions);
        await graphActions.undo();
        testGraph = await changeWatcher;

        assert.strictEqual(testGraph.nodes.length, 2);
        assert.strictEqual(testGraph.edges.length, 0);

        const changeWatcher2 = editorChange(graphActions);
        await graphActions.redo();
        testGraph = await changeWatcher2;

        assert.strictEqual(testGraph.nodes.length, 2);
        assert.strictEqual(testGraph.edges.length, 1);
      });

      test("changeNodeConfiguration updates node and sets signal", async () => {
        // Get the controller from the binder
        const controller = graphActions.bind.controller;

        // Verify initial state
        assert.strictEqual(controller.editor.graph.lastNodeConfigChange, null);

        // Change the configuration of node "foo"
        await graphActions.changeNodeConfiguration(
          "foo",
          "", // main graph
          { prompt: "Hello world" }
        );

        // Verify the signal was set
        const change = controller.editor.graph
          .lastNodeConfigChange as ConfigChangeContext | null;
        assert.ok(change, "lastNodeConfigChange should be set");
        assert.strictEqual(change.nodeId, "foo");
        assert.strictEqual(change.graphId, "");
        assert.deepStrictEqual(change.configuration, { prompt: "Hello world" });
        assert.strictEqual(
          typeof change.titleUserModified,
          "boolean",
          "titleUserModified should be a boolean"
        );

        // Verify the node configuration was actually updated
        const node = testGraph.nodes.find((n) => n.id === "foo");
        assert.ok(node, "Node should exist");
        assert.deepStrictEqual(node.configuration, { prompt: "Hello world" });
      });

      test("changeNodeConfiguration throws when node doesn't exist", async () => {
        await assert.rejects(
          async () => {
            await graphActions.changeNodeConfiguration(
              "nonexistent",
              "",
              { prompt: "test" }
            );
          },
          (err: Error) => err.message.includes("nonexistent")
        );
      });
    });
  });
});
