/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import * as Board from "../../../../src/sca/actions/board/board-actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { AppController } from "../../../../src/sca/controller/controller.js";
import { makeTestGraphStore } from "../../../helpers/_graph-store.js";
import { testKit } from "../../../test-kit.js";
import { GraphDescriptor } from "@breadboard-ai/types";

function makeFreshGraph(): GraphDescriptor {
  return {
    url: "https://example.com/board.json",
    edges: [],
    nodes: [{ id: "foo", type: "promptTemplate" }],
  } satisfies GraphDescriptor;
}

/**
 * Creates a mock logger for testing.
 */
function makeMockLogger() {
  const logs: { message: unknown; label: string }[] = [];
  return {
    log: (message: unknown, label: string) => {
      logs.push({ message, label });
    },
    logs,
  };
}

/**
 * Creates a mock GoogleDriveBoardServer for testing.
 */
function makeMockBoardServer(options: {
  canSave?: boolean;
  saveResult?: { result: boolean };
  saveShouldThrow?: boolean;
}) {
  let lastSavedGraph: GraphDescriptor | null = null;
  let saveCallCount = 0;

  return {
    canProvide: () => ({
      save: options.canSave ?? true,
    }),
    save: async (_url: URL, graph: GraphDescriptor, _userInitiated: boolean) => {
      saveCallCount++;
      if (options.saveShouldThrow) {
        throw new Error("Save failed");
      }
      lastSavedGraph = graph;
      return options.saveResult ?? { result: true };
    },
    // Test helpers
    get lastSavedGraph() {
      return lastSavedGraph;
    },
    get saveCallCount() {
      return saveCallCount;
    },
  };
}

/**
 * Creates a mock controller with the given graph state.
 */
function makeMockController(options: {
  editor: unknown;
  url: string | null;
  readOnly: boolean;
}) {
  const mockLogger = makeMockLogger();
  return {
    controller: {
      editor: {
        graph: options,
      },
      global: {
        debug: {
          enabled: false,
        },
      },
    } as AppController,
    mockLogger,
  };
}

suite("Board Actions", () => {
  suite("save", () => {
    const boardActions = Board;

    suite("programming errors", () => {
      test("throws when no editor", async () => {
        const graphStore = makeTestGraphStore({ kits: [testKit] });

        const { controller } = makeMockController({
          editor: null,
          url: "https://example.com/board.json",
          readOnly: false,
        });

        boardActions.bind({
          services: {
            graphStore,
            googleDriveBoardServer: makeMockBoardServer({ canSave: true }),
          } as unknown as AppServices,
          controller,
        });

        await assert.rejects(
          async () => boardActions.save(),
          { message: "save() called without an active editor" }
        );
      });
    });

    suite("guard conditions (silent return)", () => {
      test("returns undefined when no URL", async () => {
        const graphStore = makeTestGraphStore({ kits: [testKit] });
        const testGraph = makeFreshGraph();
        const mainGraphId = graphStore.addByDescriptor(testGraph);
        if (!mainGraphId.success) assert.fail("Unable to create graph");
        const editor = graphStore.edit(mainGraphId.result);

        const { controller } = makeMockController({
          editor,
          url: null, // No URL
          readOnly: false,
        });

        boardActions.bind({
          services: {
            graphStore,
            googleDriveBoardServer: makeMockBoardServer({ canSave: true }),
          } as unknown as AppServices,
          controller,
        });

        const result = await boardActions.save();
        assert.strictEqual(result, undefined);
      });

      test("returns undefined when readOnly", async () => {
        const graphStore = makeTestGraphStore({ kits: [testKit] });
        const testGraph = makeFreshGraph();
        const mainGraphId = graphStore.addByDescriptor(testGraph);
        if (!mainGraphId.success) assert.fail("Unable to create graph");
        const editor = graphStore.edit(mainGraphId.result);

        const { controller } = makeMockController({
          editor,
          url: "https://example.com/board.json",
          readOnly: true, // Read-only
        });

        boardActions.bind({
          services: {
            graphStore,
            googleDriveBoardServer: makeMockBoardServer({ canSave: true }),
          } as unknown as AppServices,
          controller,
        });

        const result = await boardActions.save();
        assert.strictEqual(result, undefined);
      });

      test("returns undefined when board server cannot save", async () => {
        const graphStore = makeTestGraphStore({ kits: [testKit] });
        const testGraph = makeFreshGraph();
        const mainGraphId = graphStore.addByDescriptor(testGraph);
        if (!mainGraphId.success) assert.fail("Unable to create graph");
        const editor = graphStore.edit(mainGraphId.result);

        const { controller } = makeMockController({
          editor,
          url: "https://example.com/board.json",
          readOnly: false,
        });

        boardActions.bind({
          services: {
            graphStore,
            googleDriveBoardServer: makeMockBoardServer({ canSave: false }),
          } as unknown as AppServices,
          controller,
        });

        const result = await boardActions.save();
        assert.strictEqual(result, undefined);
      });
    });

    suite("successful save", () => {
      test("calls board server save with graph", async () => {
        const graphStore = makeTestGraphStore({ kits: [testKit] });
        const testGraph = makeFreshGraph();
        const mainGraphId = graphStore.addByDescriptor(testGraph);
        if (!mainGraphId.success) assert.fail("Unable to create graph");
        const editor = graphStore.edit(mainGraphId.result);

        const mockBoardServer = makeMockBoardServer({ canSave: true });
        const { controller } = makeMockController({
          editor,
          url: "https://example.com/board.json",
          readOnly: false,
        });

        boardActions.bind({
          services: {
            graphStore,
            googleDriveBoardServer: mockBoardServer,
          } as unknown as AppServices,
          controller,
        });

        const result = await boardActions.save();

        assert.ok(result, "Should return a result");
        assert.strictEqual(result.result, true);
        assert.strictEqual(mockBoardServer.saveCallCount, 1);
        assert.ok(mockBoardServer.lastSavedGraph, "Should have saved a graph");
      });
    });

    suite("error handling", () => {
      test("returns error result when save throws", async () => {
        const graphStore = makeTestGraphStore({ kits: [testKit] });
        const testGraph = makeFreshGraph();
        const mainGraphId = graphStore.addByDescriptor(testGraph);
        if (!mainGraphId.success) assert.fail("Unable to create graph");
        const editor = graphStore.edit(mainGraphId.result);

        const mockBoardServer = makeMockBoardServer({
          canSave: true,
          saveShouldThrow: true,
        });
        const { controller } = makeMockController({
          editor,
          url: "https://example.com/board.json",
          readOnly: false,
        });

        boardActions.bind({
          services: {
            graphStore,
            googleDriveBoardServer: mockBoardServer,
          } as unknown as AppServices,
          controller,
        });

        const result = await boardActions.save();

        assert.ok(result, "Should return a result");
        assert.strictEqual(result.result, false);
      });
    });
  });
});
