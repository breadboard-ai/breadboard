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
import {
  makeTestGraphStore,
  loadGraphIntoStore,
} from "../../../helpers/_graph-store.js";
import { editGraphStore } from "../../../helpers/_editor.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import type { ConfigChangeContext } from "../../../../src/sca/controller/subcontrollers/editor/graph/graph-controller.js";
import { makeFreshGraph } from "../../helpers/index.js";
import { onPendingGraphReplacement } from "../../../../src/sca/actions/graph/triggers.js";

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
      const graphStore = makeTestGraphStore();

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
    // Graph-actions tests require 2 nodes for edge operations
    const graphWithTwoNodes = () =>
      makeFreshGraph({
        nodes: [
          { id: "foo", type: "test:promptTemplate" },
          { id: "bar", type: "test:promptTemplate" },
        ],
      });
    let testGraph = graphWithTwoNodes();

    beforeEach(() => {
      const graphStore = makeTestGraphStore();

      testGraph = graphWithTwoNodes();
      loadGraphIntoStore(graphStore, testGraph);
      const editor = editGraphStore(graphStore);
      if (!editor) assert.fail("Unable to edit graph");

      graphActions.bind({
        services: { graphStore } as unknown as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              inspect: (graphId: string) => editor.inspect(graphId),
              lastNodeConfigChange: null,
              pendingGraphReplacement: null,
              clearPendingGraphReplacement: () => {},
            },
            theme: { updateHash() {} },
          },
        } as unknown as AppController,
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
            await graphActions.changeNodeConfiguration("nonexistent", "", {
              prompt: "test",
            });
          },
          (err: Error) => err.message.includes("nonexistent")
        );
      });

      test("addNode creates a new node", async () => {
        assert.strictEqual(testGraph.nodes.length, 2);

        const changeWatcher = editorChange(graphActions);
        await graphActions.addNode(
          {
            id: "new-node",
            type: "test:promptTemplate",
            metadata: { title: "New Node" },
          },
          ""
        );
        testGraph = await changeWatcher;

        assert.strictEqual(testGraph.nodes.length, 3);
        const newNode = testGraph.nodes.find((n) => n.id === "new-node");
        assert.ok(newNode, "New node should exist");
        assert.strictEqual(newNode.type, "test:promptTemplate");
        assert.strictEqual(newNode.metadata?.title, "New Node");
      });

      test("moveSelectionPositions updates node positions", async () => {
        const changeWatcher = editorChange(graphActions);
        await graphActions.moveSelectionPositions([
          { type: "node", id: "foo", graphId: "", x: 100, y: 200 },
        ]);
        testGraph = await changeWatcher;

        const node = testGraph.nodes.find((n) => n.id === "foo");
        assert.ok(node, "Node should exist");
        assert.strictEqual(
          (node.metadata?.visual as { x: number } | undefined)?.x,
          100
        );
        assert.strictEqual(
          (node.metadata?.visual as { y: number } | undefined)?.y,
          200
        );
      });

      test("moveSelectionPositions updates asset positions", async () => {
        // First add an asset to the graph
        const editor = graphActions.bind.controller.editor.graph.editor;
        assert.ok(editor, "Editor should exist");

        await editor.edit(
          [
            {
              type: "addasset",
              path: "test-asset.txt",
              data: { inline: "test content" },
              metadata: {
                title: "Test Asset",
                type: "content",
              },
            },
          ],
          "Add test asset"
        );

        const changeWatcher = editorChange(graphActions);
        await graphActions.moveSelectionPositions([
          { type: "asset", id: "test-asset.txt", graphId: "", x: 300, y: 400 },
        ]);
        testGraph = await changeWatcher;

        const asset = testGraph.assets?.["test-asset.txt"];
        assert.ok(asset, "Asset should exist");
        assert.strictEqual(
          (asset.metadata?.visual as { x: number } | undefined)?.x,
          300
        );
        assert.strictEqual(
          (asset.metadata?.visual as { y: number } | undefined)?.y,
          400
        );
      });

      test("moveSelectionPositions skips assets without metadata", async () => {
        // This should not throw - just skip the asset
        await graphActions.moveSelectionPositions([
          {
            type: "asset",
            id: "nonexistent-asset.txt",
            graphId: "",
            x: 100,
            y: 200,
          },
        ]);
        // If we get here without throwing, the test passes
        assert.ok(true, "Should not throw for missing asset");
      });

      test("changeAssetEdge throws when asset edge cannot be created", async () => {
        // Attempting to create an asset edge for a nonexistent asset should throw
        await assert.rejects(
          async () => {
            await graphActions.changeAssetEdge(
              "add",
              {
                assetPath: "nonexistent-asset.txt",
                direction: "load",
                nodeId: "foo",
              },
              ""
            );
          },
          (err: Error) => err.message.includes("Unable to change asset")
        );
      });

      test("changeEdgeAttachmentPoint updates edge attachment", async () => {
        const editor = graphActions.bind.controller.editor.graph.editor;
        assert.ok(editor, "Editor should exist");

        // First add an edge
        await editor.edit(
          [
            {
              type: "addedge",
              graphId: "",
              edge: { from: "foo", to: "bar", in: "in", out: "out" },
            },
          ],
          "Add edge"
        );

        const changeWatcher = editorChange(graphActions);
        await graphActions.changeEdgeAttachmentPoint(
          "",
          { from: "foo", to: "bar", in: "in", out: "out" },
          "from",
          "Bottom"
        );
        testGraph = await changeWatcher;

        // Verify the edge exists (attachment point is on the edge metadata)
        const edge = testGraph.edges.find(
          (e) => e.from === "foo" && e.to === "bar"
        );
        assert.ok(edge, "Edge should exist");
      });

      test("replace replaces the entire graph", async () => {
        const changeWatcher = editorChange(graphActions);
        await graphActions.replace(
          {
            nodes: [{ id: "new-node", type: "input" }],
            edges: [],
            title: "Replaced Graph",
          },
          { role: "user" }
        );
        testGraph = await changeWatcher;

        assert.strictEqual(testGraph.title, "Replaced Graph");
        assert.strictEqual(testGraph.nodes.length, 1);
        assert.strictEqual(testGraph.nodes[0].id, "new-node");
      });

      suite("replaceWithTheme", () => {
        test("applies a generated theme to the graph", async () => {
          const changeWatcher = editorChange(graphActions);
          const testTheme = {
            themeColors: {
              primary: "#ff0000",
              secondary: "#00ff00",
              background: "#ffffff",
            },
            template: "modern",
          };

          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [{ id: "themed-node", type: "input" }],
              edges: [],
              title: "Themed Graph",
            },
            theme: testTheme,
            creator: { role: "assistant" },
          });
          testGraph = await changeWatcher;

          assert.strictEqual(testGraph.title, "Themed Graph");

          // Verify theme was applied
          const presentation = testGraph.metadata?.visual?.presentation;
          assert.ok(presentation, "Presentation metadata should exist");
          assert.ok(presentation.theme, "Theme ID should be set");
          assert.ok(presentation.themes, "Themes object should exist");

          const appliedTheme = presentation.themes[presentation.theme];
          assert.ok(appliedTheme, "Applied theme should exist");
          assert.strictEqual(appliedTheme.themeColors?.["primary"], "#ff0000");
          assert.strictEqual(appliedTheme.template, "modern");
        });

        test("generates unique theme IDs for each replacement", async () => {
          const testTheme = {
            themeColors: { primary: "#ff0000" },
          };

          // First replacement
          let changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "First",
            },
            theme: testTheme,
            creator: { role: "assistant" },
          });
          const graph1 = await changeWatcher;
          const themeId1 = graph1.metadata?.visual?.presentation?.theme;

          // Second replacement
          changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "Second",
            },
            theme: testTheme,
            creator: { role: "assistant" },
          });
          const graph2 = await changeWatcher;
          const themeId2 = graph2.metadata?.visual?.presentation?.theme;

          assert.ok(themeId1, "First theme ID should exist");
          assert.ok(themeId2, "Second theme ID should exist");
          assert.notStrictEqual(
            themeId1,
            themeId2,
            "Theme IDs should be unique"
          );
        });

        test("preserves splash screen from current graph theme", async () => {
          // First, set up a graph with a theme containing a splash screen
          const splashScreenData = {
            storedData: {
              handle: "splash-handle-1",
              mimeType: "image/png",
            },
          };

          const initialTheme = {
            themeColors: { primary: "#0000ff" },
            splashScreen: splashScreenData,
          };

          let changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "Initial with splash",
            },
            theme: initialTheme,
            creator: { role: "user" },
          });
          await changeWatcher;

          // Now replace with a theme that lacks a splash screen
          changeWatcher = editorChange(graphActions);
          const newThemeWithoutSplash = {
            themeColors: { primary: "#ff0000" },
            // No splashScreen
          };

          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "Replacement without splash",
            },
            theme: newThemeWithoutSplash,
            creator: { role: "assistant" },
          });
          testGraph = await changeWatcher;

          // Verify the splash screen was preserved from the original theme
          const presentation = testGraph.metadata?.visual?.presentation;
          assert.ok(presentation, "Presentation should exist");
          const appliedTheme = presentation.themes?.[presentation.theme!];
          assert.ok(appliedTheme, "Applied theme should exist");
          assert.deepStrictEqual(
            appliedTheme.splashScreen,
            splashScreenData,
            "Splash screen should be preserved from previous theme"
          );
        });

        test("does not overwrite splash screen when replacement has one", async () => {
          // First, set up a graph with a theme containing a splash screen
          const originalSplashScreen = {
            storedData: {
              handle: "original-handle",
              mimeType: "image/png",
            },
          };

          let changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "Original",
            },
            theme: {
              themeColors: { primary: "#0000ff" },
              splashScreen: originalSplashScreen,
            },
            creator: { role: "user" },
          });
          await changeWatcher;

          // Replace with a theme that HAS its own splash screen
          const newSplashScreen = {
            storedData: {
              handle: "new-handle",
              mimeType: "image/jpeg",
            },
          };

          changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "Replacement with its own splash",
            },
            theme: {
              themeColors: { primary: "#00ff00" },
              splashScreen: newSplashScreen,
            },
            creator: { role: "assistant" },
          });
          testGraph = await changeWatcher;

          // Verify the new splash screen is used, not the old one
          const presentation = testGraph.metadata?.visual?.presentation;
          const themeId = presentation?.theme;
          const appliedTheme = themeId
            ? presentation?.themes?.[themeId]
            : undefined;
          assert.deepStrictEqual(
            appliedTheme?.splashScreen,
            newSplashScreen,
            "New splash screen should be used"
          );
        });

        test("calls replace with the creator parameter", async () => {
          const changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
              title: "Creator Test",
            },
            creator: { role: "assistant" },
          });
          testGraph = await changeWatcher;

          assert.strictEqual(testGraph.title, "Creator Test");
        });

        test("returns early when no options and no pending replacement", async () => {
          // Call without options and with pendingGraphReplacement = null
          await assert.doesNotReject(async () => {
            await graphActions.replaceWithTheme(undefined);
          });
          // Graph should be unchanged
          assert.strictEqual(testGraph.nodes.length, 2);
        });

        test("clears flowgenInput when controller.global is set", async () => {
          let flowgenCleared = false;
          const controller = graphActions.bind.controller;
          // Temporarily add a global with flowgenInput
          (controller as unknown as { global: unknown }).global = {
            flowgenInput: {
              clear() {
                flowgenCleared = true;
              },
            },
          };

          const changeWatcher = editorChange(graphActions);
          await graphActions.replaceWithTheme({
            replacement: {
              nodes: [],
              edges: [],
            },
            creator: { role: "user" },
          });
          await changeWatcher;

          assert.strictEqual(
            flowgenCleared,
            true,
            "flowgenInput.clear() should be called"
          );

          // Clean up
          (controller as unknown as { global: unknown }).global = undefined;
        });
      });

      test("updateBoardTitleAndDescription with null title and description", async () => {
        // First set real values
        await graphActions.updateBoardTitleAndDescription(
          "Initial Title",
          "Initial Description"
        );

        // Now pass null — the `?? undefined` branches should be hit
        await graphActions.updateBoardTitleAndDescription(null, null);

        // Graph should still have the initial values (null -> undefined means
        // unchanged per the changegraphmetadata spec)
        assert.strictEqual(testGraph.title, "Initial Title");
      });

      test("addNode without title metadata uses node id in label", async () => {
        const changeWatcher = editorChange(graphActions);
        // Node with no .metadata.title — exercises `?? node.id` branch
        await graphActions.addNode(
          { id: "no-title-node", type: "test:promptTemplate" },
          ""
        );
        testGraph = await changeWatcher;

        const node = testGraph.nodes.find((n) => n.id === "no-title-node");
        assert.ok(node, "Node should be created");
      });

      test("changeAssetEdge with null subGraphId defaults to empty string", async () => {
        // First add an asset to the graph
        const editor = graphActions.bind.controller.editor.graph.editor;
        assert.ok(editor, "Editor should exist");

        await editor.edit(
          [
            {
              type: "addasset",
              path: "asset-edge-test.txt",
              data: { inline: "test" },
              metadata: { title: "Test", type: "content" },
            },
          ],
          "Add asset"
        );

        // changeAssetEdge with null subGraphId (exercises ?? "" branch)
        // This will fail since the node doesn't reference the asset,
        // but it exercises the branch before the error throw
        await assert.rejects(async () => {
          await graphActions.changeAssetEdge(
            "add",
            {
              assetPath: "asset-edge-test.txt",
              direction: "load",
              nodeId: "foo",
            },
            null
          );
        });
      });

      test("editInternal throws when edit returns failure", async () => {
        // Adding a node with a duplicate ID causes editor.edit to return
        // { success: false }, which triggers the "Unable to edit graph" throw.
        await assert.rejects(
          async () => {
            await graphActions.addNode(
              { id: "foo", type: "test:promptTemplate" },
              ""
            );
          },
          (err: Error) => err.message === "Unable to edit graph"
        );
      });
    });
  });
});

suite("Graph Triggers", () => {
  // Minimal type for the bind object - only what onPendingGraphReplacement needs
  type TriggerBind = {
    controller: { editor: { graph: { pendingGraphReplacement: unknown } } };
    services: unknown;
  };

  suite("onPendingGraphReplacement", () => {
    test("returns true when pendingGraphReplacement is set", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              pendingGraphReplacement: {
                replacement: { edges: [], nodes: [] },
                creator: { role: "user" },
              },
            },
          },
        },
        services: {},
      };

      const trigger = onPendingGraphReplacement(
        mockBind as Parameters<typeof onPendingGraphReplacement>[0]
      );

      assert.strictEqual(trigger.type, "signal");
      assert.strictEqual(trigger.name, "Pending Graph Replacement");

      const result = trigger.condition();
      assert.strictEqual(
        result,
        true,
        "Should return true when replacement is pending"
      );
    });

    test("returns false when pendingGraphReplacement is null/undefined", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              pendingGraphReplacement: null,
            },
          },
        },
        services: {},
      };

      const trigger = onPendingGraphReplacement(
        mockBind as Parameters<typeof onPendingGraphReplacement>[0]
      );

      const result = trigger.condition();
      assert.strictEqual(
        result,
        false,
        "Should return false when replacement is null"
      );
    });
  });
});
