/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import {
  suite,
  test,
  beforeEach,
  mock,
  before,
  after,
  afterEach,
} from "node:test";
import * as Board from "../../../../src/sca/actions/board/board-actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { AppController } from "../../../../src/sca/controller/controller.js";
import { coordination } from "../../../../src/sca/coordination.js";
import { StateEvent } from "../../../../src/ui/events/events.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import {
  makeMockSnackbarController,
  makeMockBoardServer,
  makeFreshGraph,
} from "../../helpers/index.js";
import {
  makeTestGraphStore,
  loadGraphIntoStore,
} from "../../../helpers/_graph-store.js";
import { editGraphStore } from "../../../helpers/_editor.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates a mock controller shaped for route-action tests.
 *
 * Provides the minimum surface each action needs. Individual tests override
 * specific parts via spread or direct mutation.
 */
function makeMockRouteController(
  overrides: {
    graph?: unknown;
    url?: string | null;
    readOnly?: boolean;
    finalOutputValues?: unknown;
    editor?: unknown;
    runner?: unknown;
  } = {}
) {
  const mockSnackbars = makeMockSnackbarController();
  let deselectAllCalled = false;
  const goArgs: unknown[] = [];
  const recentRemoves: string[] = [];

  return {
    controller: {
      editor: {
        graph: {
          graph:
            "graph" in overrides ? overrides.graph : { nodes: [], edges: [] },
          url: overrides.url ?? null,
          readOnly: overrides.readOnly ?? false,
          finalOutputValues: overrides.finalOutputValues,
          editor: overrides.editor ?? null,
        },
        selection: {
          deselectAll: () => {
            deselectAllCalled = true;
          },
        },
      },
      global: {
        debug: { enabled: false },
        snackbars: mockSnackbars,
        main: { blockingAction: false },
        consent: {
          queryConsent: async () => true,
        },
        flags: {
          flags: async () => ({ requireConsentForGetWebpage: false }),
        },
        toasts: {
          toast: () => "toast-id",
          update: () => {},
          remove: () => {},
        },
      },
      run: {
        main: {
          runner: overrides.runner ?? {
            start: mock.fn(),
          },
          abortController: null as AbortController | null,
          reset: mock.fn(),
          setStatus: mock.fn(),
          bumpStopVersion: mock.fn(),
        },
        screen: {
          reset: mock.fn(),
        },
        renderer: {
          reset: mock.fn(),
        },
      },
      router: {
        go: (params: unknown) => {
          goArgs.push(params);
        },
        parsedUrl: { page: "graph" },
      },
      home: {
        recent: {
          remove: (url: string) => {
            recentRemoves.push(url);
          },
          isSettled: Promise.resolve(),
        },
      },
    } as unknown as AppController,
    mockSnackbars,
    goArgs,
    get deselectAllCalled() {
      return deselectAllCalled;
    },
    get recentRemoves() {
      return recentRemoves;
    },
  };
}

function makeMockServices(
  overrides: {
    signInResult?: string;
    boardServer?: ReturnType<typeof makeMockBoardServer>;
  } = {}
) {
  return {
    stateEventBus: new EventTarget(),
    askUserToSignInIfNeeded: async () => overrides.signInResult ?? "success",
    googleDriveBoardServer: overrides.boardServer ?? makeMockBoardServer({}),
    actionTracker: {
      runApp: mock.fn(),
    },
    embedHandler: {
      sendToEmbedder: mock.fn(),
    },
  } as unknown as AppServices;
}

// =============================================================================
// Tests
// =============================================================================

suite("Board Route Actions", () => {
  before(() => setDOM());
  after(() => unsetDOM());

  beforeEach(() => {
    coordination.reset();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  // ===========================================================================
  // onSave
  // ===========================================================================

  suite("onSave", () => {
    test("calls save and persists the graph", async () => {
      const graphStore = makeTestGraphStore();
      const testGraph = makeFreshGraph();
      loadGraphIntoStore(graphStore, testGraph);
      const editor = editGraphStore(graphStore);

      const boardServer = makeMockBoardServer({});
      const { controller, mockSnackbars } = makeMockRouteController({
        editor,
        url: "https://example.com/board.json",
      });
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onSave();

      assert.strictEqual(
        boardServer.saveCallCount,
        1,
        "board should be saved once"
      );
      assert.ok(boardServer.lastSavedGraph, "saved graph should be available");
      // Verify snackbar was shown (pending, then success)
      assert.ok(
        mockSnackbars.entries.size > 0,
        "snackbar should be shown during save"
      );
    });
  });

  // ===========================================================================
  // onRun
  // ===========================================================================

  suite("onRun", () => {
    test("returns early when no graph is loaded", async () => {
      const { controller } = makeMockRouteController({ graph: null });
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onRun();

      // runner.start should NOT have been called
      assert.strictEqual(
        (
          controller.run.main.runner as unknown as {
            start: { mock: { callCount: () => number } };
          }
        ).start.mock.callCount(),
        0,
        "runner.start should not be called when no graph"
      );
    });

    test("returns early when sign-in fails", async () => {
      const { controller } = makeMockRouteController();
      const services = makeMockServices({ signInResult: "cancelled" });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onRun();

      assert.strictEqual(
        (
          controller.run.main.runner as unknown as {
            start: { mock: { callCount: () => number } };
          }
        ).start.mock.callCount(),
        0,
        "runner.start should not be called when sign-in fails"
      );
    });

    test("returns early when runner is not available", async () => {
      const { controller } = makeMockRouteController({ runner: null });
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      // Should not throw
      await Board.onRun();
    });

    test("starts runner on happy path", async () => {
      const startFn = mock.fn();
      const { controller } = makeMockRouteController({
        runner: { start: startFn },
      });
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onRun();

      assert.strictEqual(
        startFn.mock.callCount(),
        1,
        "runner.start should be called"
      );
    });

    test("returns early when consent is denied for get_webpage tool", async () => {
      const startFn = mock.fn();
      const mockEditor = {
        inspect: () => ({
          usesTool: (tool: string) =>
            tool === "embed://a2/tools.bgl.json#module:get-webpage",
        }),
      };

      const { controller } = makeMockRouteController({
        runner: { start: startFn },
        readOnly: true,
        url: "drive:/shared-board",
        editor: mockEditor,
      });

      // Override flags to require consent
      (
        controller.global as unknown as {
          flags: {
            flags: () => Promise<{ requireConsentForGetWebpage: boolean }>;
          };
        }
      ).flags = {
        flags: async () => ({ requireConsentForGetWebpage: true }),
      };

      // Override consent to deny
      (
        controller.global as unknown as {
          consent: { queryConsent: () => Promise<boolean> };
        }
      ).consent = {
        queryConsent: async () => false,
      };

      const boardServer = makeMockBoardServer({});
      (boardServer as unknown as { galleryGraphs: Set<string> }).galleryGraphs =
        new Set();
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onRun();

      assert.strictEqual(
        startFn.mock.callCount(),
        0,
        "runner.start should not be called when consent denied"
      );
    });

    test("skips consent for gallery apps", async () => {
      const startFn = mock.fn();
      const mockEditor = {
        inspect: () => ({
          usesTool: () => true,
        }),
      };

      const { controller } = makeMockRouteController({
        runner: { start: startFn },
        readOnly: true,
        url: "drive:/gallery-board",
        editor: mockEditor,
      });

      // Override flags to require consent
      (
        controller.global as unknown as {
          flags: {
            flags: () => Promise<{ requireConsentForGetWebpage: boolean }>;
          };
        }
      ).flags = {
        flags: async () => ({ requireConsentForGetWebpage: true }),
      };

      const boardServer = makeMockBoardServer({});
      (boardServer as unknown as { galleryGraphs: Set<string> }).galleryGraphs =
        new Set(["drive:/gallery-board"]);
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onRun();

      assert.strictEqual(
        startFn.mock.callCount(),
        1,
        "runner.start should be called for gallery apps"
      );
    });
  });

  // ===========================================================================
  // onStop
  // ===========================================================================

  suite("onStop", () => {
    test("returns early when no graph is loaded", async () => {
      const { controller } = makeMockRouteController({ graph: null });
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onStop();

      // run.main.reset should NOT be called
      assert.strictEqual(
        (
          controller.run.main.reset as unknown as ReturnType<typeof mock.fn>
        ).mock.callCount(),
        0,
        "reset should not be called"
      );
    });

    test("resets run state and sets STOPPED status", async () => {
      const { controller } = makeMockRouteController();
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onStop();

      assert.strictEqual(
        (
          controller.run.main.reset as unknown as ReturnType<typeof mock.fn>
        ).mock.callCount(),
        1,
        "run.main.reset should be called"
      );
      assert.strictEqual(
        (
          controller.run.screen.reset as unknown as ReturnType<typeof mock.fn>
        ).mock.callCount(),
        1,
        "run.screen.reset should be called"
      );
      assert.strictEqual(
        (
          controller.run.renderer.reset as unknown as ReturnType<typeof mock.fn>
        ).mock.callCount(),
        1,
        "run.renderer.reset should be called"
      );
      assert.strictEqual(
        (
          controller.run.main.setStatus as unknown as ReturnType<typeof mock.fn>
        ).mock.callCount(),
        1,
        "setStatus should be called"
      );
      assert.strictEqual(
        (
          controller.run.main.bumpStopVersion as unknown as ReturnType<
            typeof mock.fn
          >
        ).mock.callCount(),
        1,
        "bumpStopVersion should be called to trigger re-preparation"
      );
    });

    test("aborts running controller when present", async () => {
      const abortController = new AbortController();
      const { controller } = makeMockRouteController();
      (
        controller.run.main as unknown as { abortController: AbortController }
      ).abortController = abortController;
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onStop();

      assert.strictEqual(
        abortController.signal.aborted,
        true,
        "AbortController should be aborted"
      );
    });

    test("clears finalOutputValues and strips results param", async () => {
      const { controller, goArgs } = makeMockRouteController({
        finalOutputValues: { output: "test" },
      });
      (
        controller.router as unknown as {
          parsedUrl: { page: string; results: string };
        }
      ).parsedUrl = { page: "graph", results: "encoded-data" };
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onStop();

      assert.strictEqual(
        (controller.editor.graph as unknown as { finalOutputValues: unknown })
          .finalOutputValues,
        undefined,
        "finalOutputValues should be cleared"
      );

      assert.strictEqual(goArgs.length, 1, "router.go should be called");
      const goParam = goArgs[0] as { results: undefined };
      assert.strictEqual(
        goParam.results,
        undefined,
        "results should be stripped"
      );
    });
  });

  // ===========================================================================
  // onRestart
  // ===========================================================================

  suite("onRestart", () => {
    test("calls onStop, logs analytics, then runs board", async () => {
      const startFn = mock.fn();
      const { controller } = makeMockRouteController({
        url: "drive:/my-board",
        runner: { start: startFn },
      });
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Board.onRestart();

      // onStop ran (reset was called)
      assert.strictEqual(
        (
          controller.run.main.reset as unknown as ReturnType<typeof mock.fn>
        ).mock.callCount(),
        1,
        "onStop should have called reset"
      );

      // Analytics logged
      assert.strictEqual(
        (
          services.actionTracker as unknown as {
            runApp: ReturnType<typeof mock.fn>;
          }
        ).runApp.mock.callCount(),
        1,
        "actionTracker.runApp should be called"
      );

      // runner.start was called (runBoard completed)
      assert.strictEqual(
        startFn.mock.callCount(),
        1,
        "runner.start should be called"
      );
    });
  });

  // ===========================================================================
  // onInput
  // ===========================================================================

  suite("onInput", () => {
    test("returns early when no graph is loaded", async () => {
      const { controller } = makeMockRouteController({ graph: null });
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.input">({
        eventType: "board.input",
        data: { input: "hello" },
        id: "input-1",
        allowSavingIfSecret: false,
      });

      // Should not throw
      await Board.onInput(evt);
    });

    test("calls provideInput with event data", async () => {
      const { controller } = makeMockRouteController();
      const services = makeMockServices();

      // We can't easily mock provideInput since it's a module import,
      // but we can verify it doesn't crash with valid inputs.
      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.input">({
        eventType: "board.input",
        data: { input: "hello" },
        id: "input-1",
        allowSavingIfSecret: false,
      });

      // Should not throw — provideInput will receive the data
      await Board.onInput(evt);
    });
  });

  // ===========================================================================
  // onCreate
  // ===========================================================================

  suite("onCreate", () => {
    test("returns early when sign-in fails", async () => {
      const { controller, goArgs } = makeMockRouteController();
      const services = makeMockServices({ signInResult: "cancelled" });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.create">({
        eventType: "board.create",
        graph: { nodes: [], edges: [] },
        editHistoryCreator: { role: "user" },
        messages: { start: "Creating...", end: "Created!", error: "Fail" },
      });

      await Board.onCreate(evt);

      assert.strictEqual(goArgs.length, 0, "router.go should not be called");
    });

    test("creates board and navigates on success", async () => {
      const testGraph = makeFreshGraph();

      const boardServer = makeMockBoardServer({
        createUrl: "https://example.com/new-board.json",
      });
      const { controller, goArgs } = makeMockRouteController();
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.create">({
        eventType: "board.create",
        graph: testGraph,
        editHistoryCreator: { role: "user" },
        messages: { start: "Creating...", end: "Created!", error: "Fail" },
      });

      await Board.onCreate(evt);

      // Should navigate to new board
      assert.ok(goArgs.length > 0, "router.go should be called");
      const goParam = goArgs[goArgs.length - 1] as { flow: string };
      assert.strictEqual(goParam.flow, "https://example.com/new-board.json");
    });

    test("notifies embedder on create", async () => {
      const boardServer = makeMockBoardServer({
        createUrl: "https://example.com/new-board.json",
      });
      const { controller } = makeMockRouteController();
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.create">({
        eventType: "board.create",
        graph: makeFreshGraph(),
        editHistoryCreator: { role: "user" },
        messages: { start: "", end: "", error: "" },
      });

      await Board.onCreate(evt);

      const embedHandler = services.embedHandler as unknown as {
        sendToEmbedder: ReturnType<typeof mock.fn>;
      };
      assert.strictEqual(
        embedHandler.sendToEmbedder.mock.callCount(),
        1,
        "sendToEmbedder should be called"
      );

      const embedCall = embedHandler.sendToEmbedder.mock.calls[0]
        .arguments[0] as { type: string; id: string };
      assert.strictEqual(embedCall.type, "board_id_created");
      assert.strictEqual(embedCall.id, "https://example.com/new-board.json");
    });
  });

  // ===========================================================================
  // onRemix
  // ===========================================================================

  suite("onRemix", () => {
    test("remixes and navigates to new board", async () => {
      const graphStore = makeTestGraphStore();
      const testGraph = makeFreshGraph();
      testGraph.title = "Original";
      loadGraphIntoStore(graphStore, testGraph);
      const editor = editGraphStore(graphStore);

      const boardServer = makeMockBoardServer({
        createUrl: "https://example.com/remixed.json",
      });
      const { controller, goArgs } = makeMockRouteController({
        editor,
        url: "https://example.com/board.json",
      });
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.remix">({
        eventType: "board.remix",
        url: "https://example.com/board.json",
        messages: { start: "Remixing...", end: "Done!", error: "Fail" },
      });

      await Board.onRemix(evt);

      // Should navigate to remixed board
      assert.ok(goArgs.length > 0, "router.go should be called");
      const goParam = goArgs[goArgs.length - 1] as { flow: string };
      assert.strictEqual(goParam.flow, "https://example.com/remixed.json");
    });

    test("notifies embedder on remix", async () => {
      const graphStore = makeTestGraphStore();
      const testGraph = makeFreshGraph();
      testGraph.title = "Original";
      loadGraphIntoStore(graphStore, testGraph);
      const editor = editGraphStore(graphStore);

      const boardServer = makeMockBoardServer({
        createUrl: "https://example.com/remixed.json",
      });
      const { controller } = makeMockRouteController({
        editor,
        url: "https://example.com/board.json",
      });
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.remix">({
        eventType: "board.remix",
        url: "https://example.com/board.json",
        messages: { start: "", end: "", error: "" },
      });

      await Board.onRemix(evt);

      const embedHandler = services.embedHandler as unknown as {
        sendToEmbedder: ReturnType<typeof mock.fn>;
      };
      assert.strictEqual(
        embedHandler.sendToEmbedder.mock.callCount(),
        1,
        "sendToEmbedder should be called"
      );

      const embedCall = embedHandler.sendToEmbedder.mock.calls[0]
        .arguments[0] as { type: string; id: string };
      assert.strictEqual(embedCall.type, "board_id_created");
      assert.strictEqual(embedCall.id, "https://example.com/remixed.json");
    });

    test("does not navigate when remix fails", async () => {
      const { controller, goArgs } = makeMockRouteController({
        editor: null,
        url: null,
      });

      const services = {
        ...makeMockServices(),
        loader: {
          load: async () => ({
            success: true,
            graph: { nodes: [], edges: [] },
          }),
        },
        googleDriveBoardServer: makeMockBoardServer({}),
      } as unknown as AppServices;

      // Override create to return no URL (create fails)
      const bs = (
        services as unknown as {
          googleDriveBoardServer: {
            create: () => Promise<{ result: false; url: undefined }>;
          };
        }
      ).googleDriveBoardServer;
      bs.create = async () => ({
        result: false,
        url: undefined,
      });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.remix">({
        eventType: "board.remix",
        url: "https://example.com/nonexistent.json",
        messages: { start: "", end: "", error: "" },
      });

      await Board.onRemix(evt);

      // Should NOT navigate since remix failed
      assert.strictEqual(goArgs.length, 0, "router.go should not be called");
    });
  });

  // ===========================================================================
  // onDelete
  // ===========================================================================

  suite("onDelete", () => {
    // confirm doesn't exist in Node.js, so we polyfill it
    // so mock.method can find it.
    before(() => {
      if (!("confirm" in globalThis)) {
        (globalThis as unknown as { confirm: () => boolean }).confirm = () =>
          false;
      }
    });

    test("returns early when user cancels confirm dialog", async () => {
      mock.method(globalThis, "confirm", () => false);

      const { controller, goArgs, recentRemoves } = makeMockRouteController();
      const services = makeMockServices();

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.delete">({
        eventType: "board.delete",
        url: "https://example.com/board.json",
        messages: {
          query: "Delete?",
          start: "Deleting...",
          end: "Deleted!",
          error: "Fail",
        },
      });

      await Board.onDelete(evt);

      assert.strictEqual(
        recentRemoves.length,
        0,
        "recent.remove should not be called"
      );
      assert.strictEqual(goArgs.length, 0, "router.go should not be called");
    });

    test("deletes board, removes from recents, and navigates home", async () => {
      mock.method(globalThis, "confirm", () => true);

      const boardServer = makeMockBoardServer({});
      const { controller, goArgs, recentRemoves } = makeMockRouteController();
      // Set page to "graph" so it triggers navigation
      (
        controller.router as unknown as { parsedUrl: { page: string } }
      ).parsedUrl = {
        page: "graph",
      };
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.delete">({
        eventType: "board.delete",
        url: "https://example.com/board.json",
        messages: {
          query: "Delete?",
          start: "Deleting...",
          end: "Deleted!",
          error: "Fail",
        },
      });

      await Board.onDelete(evt);

      // Board deleted
      assert.strictEqual(
        boardServer.deleteCallCount,
        1,
        "board should be deleted"
      );

      // Removed from recents
      assert.deepStrictEqual(recentRemoves, ["https://example.com/board.json"]);

      // Navigates home
      assert.ok(goArgs.length > 0, "router.go should be called");
      const goParam = goArgs[goArgs.length - 1] as { page: string };
      assert.strictEqual(goParam.page, "home");
    });

    test("deselects all after deletion", async () => {
      mock.method(globalThis, "confirm", () => true);

      const boardServer = makeMockBoardServer({});
      const ctx = makeMockRouteController();
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller: ctx.controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.delete">({
        eventType: "board.delete",
        url: "https://example.com/board.json",
        messages: {
          query: "Delete?",
          start: "Deleting...",
          end: "Deleted!",
          error: "Fail",
        },
      });

      await Board.onDelete(evt);

      assert.strictEqual(
        ctx.deselectAllCalled,
        true,
        "deselectAll should be called"
      );
    });

    test("stays on home page without navigating again", async () => {
      mock.method(globalThis, "confirm", () => true);

      const boardServer = makeMockBoardServer({});
      const { controller, goArgs } = makeMockRouteController();
      // Already on home page
      (
        controller.router as unknown as { parsedUrl: { page: string } }
      ).parsedUrl = {
        page: "home",
      };
      const services = makeMockServices({ boardServer });

      Board.bind({
        services,
        controller,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"board.delete">({
        eventType: "board.delete",
        url: "https://example.com/board.json",
        messages: {
          query: "Delete?",
          start: "",
          end: "",
          error: "",
        },
      });

      await Board.onDelete(evt);

      // Should NOT navigate since we're already on home
      assert.strictEqual(
        goArgs.length,
        0,
        "router.go should not be called when already on home"
      );
    });
  });
});
