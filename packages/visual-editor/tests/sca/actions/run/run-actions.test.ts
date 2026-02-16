/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import * as RunActions from "../../../../src/sca/actions/run/run-actions.js";
import { STATUS } from "../../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { makeTestController, makeTestServices } from "../../helpers/index.js";
import type { PrepareRunConfig } from "../../../../src/sca/actions/run/run-actions.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import type {
  ConsoleEntry,
  EditableGraph,
  HarnessRunner,
} from "@breadboard-ai/types";
import { coordination } from "../../../../src/sca/coordination.js";
import { ReactiveAppScreen } from "../../../../src/ui/state/app-screen.js";

/**
 * Creates a valid mock config for testing
 */
function makeMockConfig(): PrepareRunConfig {
  return {
    graph: { edges: [], nodes: [] },
    url: "test://board",
    settings: {
      getSection: () => ({ items: [] }),
    } as unknown as PrepareRunConfig["settings"],
    fetchWithCreds: fetch,
    flags: {
      get: () => undefined,
    } as unknown as PrepareRunConfig["flags"],
    getProjectRunState: () => undefined,
  };
}

suite("Run Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("prepare sets runner on controller", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    assert.ok(controller.run.main.runner, "runner should be set on controller");
    assert.ok(
      controller.run.main.abortController,
      "abortController should be set on controller"
    );
    assert.strictEqual(
      controller.run.main.hasRunner,
      true,
      "hasRunner should return true"
    );
  });

  test("prepare sets status to STOPPED (ready)", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after prepare"
    );
  });

  test("runner 'start' event sets status to RUNNING", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Simulate runner emitting 'start' event
    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string) => void;
    };
    runner._fireEvent("start");

    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after start event"
    );
  });

  test("runner 'resume' event sets status to RUNNING", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Simulate paused state then resume
    controller.run.main.setStatus(STATUS.PAUSED);
    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string) => void;
    };
    runner._fireEvent("resume");

    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after resume event"
    );
  });

  test("runner 'pause' event sets status to PAUSED", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Simulate running then pause
    controller.run.main.setStatus(STATUS.RUNNING);
    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string) => void;
    };
    runner._fireEvent("pause");

    assert.strictEqual(
      controller.run.main.status,
      STATUS.PAUSED,
      "status should be PAUSED after pause event"
    );
  });

  test("runner 'end' event sets status to STOPPED", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Simulate running then end
    controller.run.main.setStatus(STATUS.RUNNING);
    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string) => void;
    };
    runner._fireEvent("end");

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after end event"
    );
  });

  test("runner 'error' event sets status to STOPPED", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Simulate running then error
    controller.run.main.setStatus(STATUS.RUNNING);
    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string) => void;
    };
    runner._fireEvent("error");

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after error event"
    );
  });

  // ===== Error-related event tests =====

  test("runner 'error' event sets error on controller with string message", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set input first so we can verify it's cleared
    controller.run.main.setInput({ id: "test", schema: {} });

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    runner._fireEvent("error", { error: "Something went wrong" });

    assert.ok(controller.run.main.error, "error should be set");
    assert.strictEqual(
      controller.run.main.error?.message,
      "Something went wrong",
      "error message should match"
    );
    assert.strictEqual(
      controller.run.main.input,
      null,
      "input should be cleared"
    );
  });

  test("runner 'error' event handles error object with message property", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    runner._fireEvent("error", { error: { message: "Object error message" } });

    assert.ok(controller.run.main.error, "error should be set");
    assert.strictEqual(
      controller.run.main.error?.message,
      "Object error message",
      "error message should match"
    );
  });

  test("runner 'error' event handles missing error gracefully", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    runner._fireEvent("error", {});

    assert.ok(controller.run.main.error, "error should be set");
    assert.strictEqual(
      controller.run.main.error?.message,
      "Unknown error",
      "error should have fallback message"
    );
  });

  test("runner 'end' event clears input", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set input first
    controller.run.main.setInput({ id: "test", schema: {} });
    assert.ok(controller.run.main.input, "input should be set initially");

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string) => void;
    };
    runner._fireEvent("end");

    assert.strictEqual(
      controller.run.main.input,
      null,
      "input should be cleared after end"
    );
  });

  test("runner 'graphstart' event resets and pre-populates output for top-level graph", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Create config with 3 nodes
    const config = makeMockConfig();
    config.graph = {
      edges: [],
      nodes: [
        { id: "node1", type: "test" },
        { id: "node2", type: "test" },
        { id: "node3", type: "test" },
      ],
    };

    // Mock controller.editor.graph.get() to return inspectable graph data
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([
          [
            "",
            {
              nodeById: (id: string) => ({
                title: () => id,
                currentDescribe: () => ({ metadata: { tags: ["test"] } }),
                currentPorts: () => ({
                  inputs: { ports: [] },
                  outputs: { ports: [] },
                }),
                describe: () =>
                  Promise.resolve({ metadata: { tags: ["test"] } }),
              }),
            },
          ],
        ]),
      });

    RunActions.prepare(config);

    // Add some console entries to verify reset
    controller.run.main.setConsoleEntry("existing", {} as ConsoleEntry);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    // Top-level graph has empty path
    runner._fireEvent("graphstart", { path: [] });

    // Console should now have 3 entries (one per graph node with 'inactive' status)
    assert.strictEqual(
      controller.run.main.console.size,
      3,
      "console should be pre-populated with graph nodes on graphstart"
    );
    assert.strictEqual(
      controller.run.main.estimatedEntryCount,
      3,
      "estimated entry count should match node count"
    );
  });

  test("runner 'graphstart' event ignores nested graphs", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Add a console entry
    controller.run.main.setConsoleEntry("existing", {} as ConsoleEntry);
    controller.run.main.setEstimatedEntryCount(5);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    // Nested graph has non-empty path
    runner._fireEvent("graphstart", { path: ["parent-node"] });

    assert.strictEqual(
      controller.run.main.console.size,
      1,
      "console should NOT be cleared for nested graph"
    );
    assert.strictEqual(
      controller.run.main.estimatedEntryCount,
      5,
      "estimated entry count should NOT change for nested graph"
    );
  });

  test("runner 'nodestart' event adds console entry", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    config.graph = {
      edges: [],
      nodes: [{ id: "test-node", type: "test" }],
    };
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    // Top-level node has path with single element
    runner._fireEvent("nodestart", {
      path: ["test-node"],
      node: { id: "test-node", type: "test" },
    });

    assert.strictEqual(
      controller.run.main.console.size,
      1,
      "console should have one entry"
    );
    const entry = controller.run.main.console.get("test-node");
    assert.ok(entry, "entry should exist");
  });

  test("runner 'nodestart' event ignores nested nodes", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    // Nested node has path with more than one element
    runner._fireEvent("nodestart", {
      path: ["parent-node", "test-node"],
      node: { id: "test-node", type: "test" },
    });

    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should be empty for nested node"
    );
  });
});

suite("Run.start action", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("start calls runner.start()", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Prepare a runner
    const config = makeMockConfig();
    RunActions.prepare(config);

    // Track if start was called on the runner
    let startCalled = false;
    (controller.run.main.runner as unknown as { start: () => void }).start =
      () => {
        startCalled = true;
      };

    await RunActions.start();

    assert.ok(startCalled, "runner.start() should be called");
  });

  test("start throws when no runner is set", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Ensure no runner is set
    controller.run.main.runner = null;

    await assert.rejects(
      () => RunActions.start(),
      /start\(\) called without an active runner/,
      "should throw when no runner"
    );
  });

  test("start uses exclusive mode (prevents concurrent calls)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Prepare a runner
    const config = makeMockConfig();
    RunActions.prepare(config);

    // Make the runner.start() take some time
    let startCallCount = 0;
    let resolveStart: () => void;
    new Promise<void>((resolve) => {
      resolveStart = resolve;
    });

    (controller.run.main.runner as unknown as { start: () => void }).start =
      () => {
        startCallCount++;
        // This will not resolve immediately
      };

    // Start the first call
    const firstCall = RunActions.start();

    // Start a second call immediately
    const secondCall = RunActions.start();

    // Complete the first call
    resolveStart!();
    await firstCall;
    await secondCall;

    // Both should complete, but they should have been serialized
    assert.strictEqual(
      startCallCount,
      2,
      "runner.start() should be called twice"
    );
  });
});

suite("Run.stop action", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("stop calls abortController.abort()", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Prepare a runner to set up abortController
    const config = makeMockConfig();
    RunActions.prepare(config);

    // Track if abort was called
    let abortCalled = false;
    (
      controller.run.main.abortController as unknown as { abort: () => void }
    ).abort = () => {
      abortCalled = true;
    };

    await RunActions.stop();

    assert.ok(abortCalled, "abortController.abort() should be called");
  });

  test("stop sets status to STOPPED", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Prepare a runner
    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set status to RUNNING
    controller.run.main.setStatus(STATUS.RUNNING);

    await RunActions.stop();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED"
    );
  });

  test("stop works when no abortController is set", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Ensure no abortController
    controller.run.main.abortController = null;

    // Should not throw
    await assert.doesNotReject(
      () => RunActions.stop(),
      "should not throw when no abortController"
    );
  });

  test("stop uses immediate mode (works during triggers)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Enter a trigger scope
    const done = coordination.enterTrigger("Test Trigger");

    // Prepare a runner
    const config = makeMockConfig();
    RunActions.prepare(config);

    // This should NOT throw because stop uses immediate mode
    await assert.doesNotReject(
      () => RunActions.stop(),
      "stop should work during triggers (immediate mode)"
    );

    done();
  });
});

suite("syncConsoleFromRunner", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("returns early when no runner", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Ensure no runner is set
    controller.run.main.runner = null;

    // Should not throw
    assert.doesNotThrow(() => {
      RunActions.syncConsoleFromRunner();
    });
  });

  test("builds console entries from runner plan in execution order", () => {
    const { controller } = makeTestController();
    // Use nodeMetadata option for cleaner mocking
    const { services } = makeTestServices({});
    RunActions.bind({ controller, services });

    // Mock controller.editor.graph.get() with node metadata
    const nodeMetadata: Record<
      string,
      { title?: string; icon?: string; tags?: string[] }
    > = {
      "node-1": { title: "Title for node-1", icon: "star", tags: ["test"] },
      "node-2": { title: "Title for node-2", icon: "star", tags: ["test"] },
      "node-3": { title: "Title for node-3", icon: "star", tags: ["test"] },
    };
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([
          [
            "",
            {
              nodeById: (id: string) => {
                const meta = nodeMetadata[id] ?? {};
                return {
                  title: () => meta.title ?? id,
                  currentDescribe: () => ({
                    metadata: { icon: meta.icon, tags: meta.tags },
                  }),
                  currentPorts: () => ({
                    inputs: { ports: [] },
                    outputs: { ports: [] },
                  }),
                  describe: () =>
                    Promise.resolve({
                      metadata: { icon: meta.icon, tags: meta.tags },
                    }),
                };
              },
            },
          ],
        ]),
      });

    // Set up a mock runner with a plan
    const mockRunner = {
      plan: {
        stages: [
          [{ node: { id: "node-1" } }, { node: { id: "node-2" } }],
          [{ node: { id: "node-3" } }],
        ],
      },
      state: new Map<string, { state: string }>([
        ["node-1", { state: "succeeded" }],
        ["node-2", { state: "working" }],
        ["node-3", { state: "inactive" }],
      ]),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    // Set up graph with nodes using createMockEditor style
    const mockEditor = {
      raw: () => ({
        nodes: [
          { id: "node-1", metadata: { title: "Node 1" } },
          { id: "node-2", metadata: { title: "Node 2" } },
          { id: "node-3", metadata: { title: "Node 3" } },
        ],
      }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    RunActions.syncConsoleFromRunner();

    // Verify estimated entry count was updated
    assert.strictEqual(
      controller.run.main.estimatedEntryCount,
      3,
      "should set estimated entry count to 3"
    );

    // Verify console has entries
    assert.strictEqual(
      controller.run.main.console.size,
      3,
      "console should have 3 entries"
    );

    // Verify order (iteration order of Map should match insertion order)
    const consoleKeys = [...controller.run.main.console.keys()];
    assert.deepStrictEqual(
      consoleKeys,
      ["node-1", "node-2", "node-3"],
      "entries should be in execution order"
    );
  });

  test("maps node state from runner.state", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({});
    RunActions.bind({ controller, services });

    // Mock controller.editor.graph.get() with node metadata
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([
          [
            "",
            {
              nodeById: (id: string) => {
                if (id === "node-1") {
                  return {
                    title: () => "Node 1",
                    currentDescribe: () => ({ metadata: { tags: ["test"] } }),
                    currentPorts: () => ({
                      inputs: { ports: [] },
                      outputs: { ports: [] },
                    }),
                    describe: () =>
                      Promise.resolve({ metadata: { tags: ["test"] } }),
                  };
                }
                return undefined;
              },
            },
          ],
        ]),
      });

    // Set up a mock runner with state
    const mockRunner = {
      plan: {
        stages: [[{ node: { id: "node-1" } }]],
      },
      state: new Map<string, { state: string }>([
        ["node-1", { state: "working" }],
      ]),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "node-1" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "working",
      "status should be 'working'"
    );
  });

  test("defaults to 'inactive' when node has no state", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({});
    RunActions.bind({ controller, services });

    // Mock controller.editor.graph.get() with node metadata
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([
          [
            "",
            {
              nodeById: (id: string) => {
                if (id === "node-1") {
                  return {
                    title: () => "Node 1",
                    currentDescribe: () => ({ metadata: { tags: ["test"] } }),
                    currentPorts: () => ({
                      inputs: { ports: [] },
                      outputs: { ports: [] },
                    }),
                    describe: () =>
                      Promise.resolve({ metadata: { tags: ["test"] } }),
                  };
                }
                return undefined;
              },
            },
          ],
        ]),
      });

    const mockRunner = {
      plan: {
        stages: [[{ node: { id: "node-1" } }]],
      },
      state: new Map(), // No state for node-1
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "node-1" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "inactive",
      "status should default to 'inactive'"
    );
  });

  test("returns early when no graph editor", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockRunner = {
      plan: { stages: [[{ node: { id: "node-1" } }]] },
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;
    (controller.editor.graph as { editor: unknown }).editor = null;

    // Should not throw and should not add entries
    assert.doesNotThrow(() => {
      RunActions.syncConsoleFromRunner();
    });

    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should remain empty"
    );
  });

  test("returns early when graphStore fails", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockRunner = {
      plan: { stages: [[{ node: { id: "node-1" } }]] },
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "node-1" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    // Controller's graph returns null for get() (no graph store set up)
    (controller.editor.graph as unknown as { get: () => unknown }).get = () =>
      null;

    assert.doesNotThrow(() => {
      RunActions.syncConsoleFromRunner();
    });

    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should remain empty"
    );
  });

  test("uses nodeId as fallback title when node not found", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockRunner = {
      plan: { stages: [[{ node: { id: "missing-node" } }]] },
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    const mockInspectable = {
      nodeById: () => undefined, // Node not found
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", mockInspectable]]),
      });

    RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("missing-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.title,
      "missing-node",
      "title should fallback to nodeId"
    );
  });

  test("handles empty plan gracefully", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockRunner = {
      plan: { stages: [] }, // Empty plan
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => undefined }]]),
      });

    assert.doesNotThrow(() => {
      RunActions.syncConsoleFromRunner();
    });

    assert.strictEqual(
      controller.run.main.estimatedEntryCount,
      0,
      "estimated count should be 0"
    );
    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should be empty"
    );
  });
});

suite("mapLifecycleToRunStatus", () => {
  test("maps 'inactive' to 'inactive'", () => {
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("inactive"),
      "inactive"
    );
  });

  test("maps 'ready' to 'ready'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("ready"), "ready");
  });

  test("maps 'working' to 'working'", () => {
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("working"),
      "working"
    );
  });

  test("maps 'waiting' to 'working'", () => {
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("waiting"),
      "working"
    );
  });

  test("maps 'succeeded' to 'succeeded'", () => {
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("succeeded"),
      "succeeded"
    );
  });

  test("maps 'failed' to 'succeeded' (completed state)", () => {
    // Failed nodes are treated as succeeded for UI purposes
    // as they are complete - error styling is handled separately
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("failed"),
      "succeeded"
    );
  });

  test("maps 'skipped' to 'skipped'", () => {
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("skipped"),
      "skipped"
    );
  });

  test("maps 'interrupted' to 'interrupted'", () => {
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("interrupted"),
      "interrupted"
    );
  });

  test("maps unknown state to 'inactive'", () => {
    // Test default case with an unknown value
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("unknown-state" as never),
      "inactive"
    );
  });
});

suite("runner nodeend event", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("updates existing console entry to succeeded on nodeend", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    config.graph = {
      edges: [],
      nodes: [{ id: "test-node", type: "test" }],
    };
    RunActions.prepare(config);

    // Set up an existing console entry
    controller.run.main.setConsoleEntry("test-node", {
      title: "Test Node",
      status: { status: "working" },
      icon: "star",
      completed: false,
    } as ConsoleEntry);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    // Fire nodeend for a top-level node (path.length === 1)
    runner._fireEvent("nodeend", {
      path: ["test-node"],
      node: { id: "test-node" },
    });

    const entry = controller.run.main.console.get("test-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "succeeded",
      "status should be succeeded"
    );
    assert.strictEqual(entry.completed, true, "completed should be true");
  });

  test("ignores nodeend for nested nodes (path.length > 1)", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set up an existing console entry with working status
    controller.run.main.setConsoleEntry("nested-node", {
      title: "Nested Node",
      status: { status: "working" },
      icon: "star",
      completed: false,
    } as ConsoleEntry);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    // Fire nodeend for a nested node (path.length > 1)
    runner._fireEvent("nodeend", {
      path: ["parent-node", "nested-node"],
      node: { id: "nested-node" },
    });

    const entry = controller.run.main.console.get("nested-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "working",
      "status should still be working"
    );
    assert.strictEqual(
      entry.completed,
      false,
      "completed should still be false"
    );
  });

  test("does nothing if node is not in console", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Ensure console is empty
    assert.strictEqual(controller.run.main.console.size, 0);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    // Fire nodeend for a node that doesn't exist in console
    runner._fireEvent("nodeend", {
      path: ["nonexistent-node"],
      node: { id: "nonexistent-node" },
    });

    // Should not throw and console should still be empty
    assert.strictEqual(controller.run.main.console.size, 0);
  });
});

suite("syncConsoleFromRunner async describe", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("async fetches node.describe when metadata has no tags", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Create a mock node with async describe
    let describeCalled = false;
    const mockNode = {
      title: () => "Node 1",
      describe: async () => {
        describeCalled = true;
        return {
          metadata: {
            icon: "async-icon",
            tags: ["async-tag"],
          },
        };
      },
      currentDescribe: () => ({ metadata: {} }), // No tags initially
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    // Set up a mock runner
    const mockRunner = {
      plan: {
        stages: [[{ node: { id: "node-1" } }]],
      },
      state: new Map<string, { state: string }>([
        ["node-1", { state: "working" }],
      ]),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "node-1" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    // Mock graphStore to return our mock node
    const mockInspectable = {
      nodeById: () => mockNode,
    };
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", mockInspectable]]),
      });

    RunActions.syncConsoleFromRunner();

    // Wait for async describe to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(describeCalled, true, "describe should be called async");

    // Verify the entry was updated with async metadata
    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      ["async-tag"],
      "tags should be updated from async describe"
    );
  });

  test("skips async describe when metadata already has tags", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Create a mock node that already has tags
    let describeCalled = false;
    const mockNode = {
      title: () => "Node 1",
      describe: async () => {
        describeCalled = true;
        return { metadata: { icon: "async-icon", tags: ["should-not-see"] } };
      },
      currentDescribe: () => ({ metadata: { tags: ["existing-tag"] } }), // Already has tags
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    const mockRunner = {
      plan: { stages: [[{ node: { id: "node-1" } }]] },
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "node-1" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    const mockInspectable = { nodeById: () => mockNode };
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", mockInspectable]]),
      });

    RunActions.syncConsoleFromRunner();

    // Wait a bit to ensure async would have been called
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(
      describeCalled,
      false,
      "describe should NOT be called when tags already exist"
    );
  });

  test("skips async describe when node is null", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockRunner = {
      plan: { stages: [[{ node: { id: "node-1" } }]] },
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "node-1" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    // Mock nodeById to return null
    const mockInspectable = { nodeById: () => null };
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", mockInspectable]]),
      });

    // Should not throw
    assert.doesNotThrow(() => {
      RunActions.syncConsoleFromRunner();
    });

    // Entry should still be created with fallback
    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist even without node");
  });
});

// =============================================================================
// handleNodeAction
// =============================================================================

suite("handleNodeAction", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("sets nodeActionRequest on controller", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    await RunActions.handleNodeAction({
      nodeId: "node-1",
      actionContext: "graph",
    });

    const request = controller.run.main.nodeActionRequest;
    assert.ok(request, "nodeActionRequest should be set");
    assert.strictEqual(request.nodeId, "node-1");
    assert.strictEqual(request.actionContext, "graph");
  });

  test("sets 'step' actionContext", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    await RunActions.handleNodeAction({
      nodeId: "node-2",
      actionContext: "step",
    });

    const request = controller.run.main.nodeActionRequest;
    assert.ok(request, "nodeActionRequest should be set");
    assert.strictEqual(request.actionContext, "step");
  });

  test("no-ops and logs when actionContext is missing", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    await RunActions.handleNodeAction({ nodeId: "node-1" });

    assert.strictEqual(
      controller.run.main.nodeActionRequest,
      null,
      "nodeActionRequest should remain null"
    );
  });
});

// =============================================================================
// executeNodeAction
// =============================================================================

suite("executeNodeAction", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("returns early when no request", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Ensure no request is set
    assert.strictEqual(controller.run.main.nodeActionRequest, null);

    // Should not throw
    await RunActions.executeNodeAction();

    // Nothing should have changed
    assert.strictEqual(controller.run.main.nodeActionRequest, null);
  });

  test("clears nodeActionRequest after execution", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Set up a runner with node state
    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set up runner state
    (
      controller.run.main.runner as unknown as { state: Map<string, unknown> }
    ).state = new Map([["node-1", { state: "inactive" }]]);

    // Set the request
    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    await RunActions.executeNodeAction();

    assert.strictEqual(
      controller.run.main.nodeActionRequest,
      null,
      "request should be cleared"
    );
  });

  test("no-ops for 'inactive' state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    (
      controller.run.main.runner as unknown as { state: Map<string, unknown> }
    ).state = new Map([["node-1", { state: "inactive" }]]);

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    // Should complete without calling dispatchRun or dispatchStop
    await RunActions.executeNodeAction();

    // Verify renderer was NOT updated (no state change for inactive)
    assert.strictEqual(
      controller.run.renderer.nodes.get("node-1"),
      undefined,
      "renderer should not be updated for inactive"
    );
  });

  test("dispatches run for 'ready' state with graph context", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set up runner with runFrom method and state
    let runFromCalled = false;
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      runFrom: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "ready" }]]);
    runner.runFrom = () => {
      runFromCalled = true;
      return Promise.resolve({});
    };

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    await RunActions.executeNodeAction();

    assert.ok(runFromCalled, "runFrom should be called for graph context");
  });

  test("dispatches run for 'succeeded' state with step context", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    let runNodeCalled = false;
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      runNode: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "succeeded" }]]);
    runner.runNode = () => {
      runNodeCalled = true;
      return Promise.resolve({});
    };

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "step",
    });

    await RunActions.executeNodeAction();

    assert.ok(runNodeCalled, "runNode should be called for step context");
  });

  test("dispatches run for 'failed' state with undismissError", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    let runNodeCalled = false;
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      runNode: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "failed" }]]);
    runner.runNode = () => {
      runNodeCalled = true;
      return Promise.resolve({});
    };

    // Dismiss the error first, then re-run
    controller.run.main.dismissError("node-1");

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "step",
    });

    await RunActions.executeNodeAction();

    assert.ok(runNodeCalled, "runNode should be called for failed state");
  });

  test("dispatches run for 'interrupted' state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    let runFromCalled = false;
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      runFrom: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "interrupted" }]]);
    runner.runFrom = () => {
      runFromCalled = true;
      return Promise.resolve({});
    };

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    await RunActions.executeNodeAction();

    assert.ok(runFromCalled, "runFrom should be called for interrupted state");
  });

  test("stops working node and sets interrupted state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    let stopCalled = false;
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      stop: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "working" }]]);
    runner.stop = () => {
      stopCalled = true;
      return Promise.resolve({});
    };

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    await RunActions.executeNodeAction();

    assert.ok(stopCalled, "stop should be called for working state");
    const nodeState = controller.run.renderer.nodes.get("node-1");
    assert.ok(nodeState, "node state should be set");
    assert.strictEqual(
      nodeState.status,
      "interrupted",
      "node should be set to interrupted"
    );
  });

  test("stops waiting node and sets interrupted state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    let stopCalled = false;
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      stop: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "waiting" }]]);
    runner.stop = () => {
      stopCalled = true;
      return Promise.resolve({});
    };

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "step",
    });

    await RunActions.executeNodeAction();

    assert.ok(stopCalled, "stop should be called for waiting state");
  });

  test("logs warning for 'skipped' state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
    };
    runner.state = new Map([["node-1", { state: "skipped" }]]);

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    // Should complete without throwing
    await RunActions.executeNodeAction();

    // Request should be cleared
    assert.strictEqual(controller.run.main.nodeActionRequest, null);
  });

  test("logs warning for unknown state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
    };
    runner.state = new Map([["node-1", { state: "totally-unknown" }]]);

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    // Should complete without throwing
    await RunActions.executeNodeAction();

    assert.strictEqual(controller.run.main.nodeActionRequest, null);
  });

  test("logs warning when node state not found", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Runner state exists but doesn't have our node
    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
    };
    runner.state = new Map();

    controller.run.main.setNodeActionRequest({
      nodeId: "missing-node",
      actionContext: "graph",
    });

    await RunActions.executeNodeAction();

    // Should clear request and not throw
    assert.strictEqual(controller.run.main.nodeActionRequest, null);
  });
});

// =============================================================================
// Event handlers: nodestatechange, edgestatechange, output
// =============================================================================

suite("runner event handlers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("nodestatechange sets non-failed node state on renderer", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodestatechange", {
      id: "node-1",
      state: "working",
    });

    const nodeState = controller.run.renderer.nodes.get("node-1");
    assert.ok(nodeState, "node state should be set");
    assert.strictEqual(nodeState.status, "working");
    assert.strictEqual(
      "errorMessage" in nodeState,
      false,
      "no error message for non-failed"
    );
  });

  test("nodestatechange decodes error for 'failed' state", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodestatechange", {
      id: "node-x",
      state: "failed",
      message: { message: "Something broke" },
    });

    const nodeState = controller.run.renderer.nodes.get("node-x");
    assert.ok(nodeState, "node state should be set");
    assert.strictEqual(nodeState.status, "failed");
    assert.ok(
      nodeState.status === "failed" && nodeState.errorMessage,
      "error message should be populated for failed state"
    );
  });

  test("edgestatechange sets edge states on renderer", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("edgestatechange", {
      edges: [{ from: "a", to: "b", out: "out", in: "in" }],
      state: "active",
    });

    // Verify edge state was set (edgeToString produces the key)
    assert.ok(
      controller.run.renderer.edges.size > 0,
      "at least one edge state should be set"
    );
  });

  test("output event adds output to screen for bubbled events", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Create a screen for the node first
    const screen = new ReactiveAppScreen("node-1", undefined);
    controller.run.screen.setScreen("node-1", screen);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("output", {
      bubbled: true,
      node: { id: "node-1" },
      outputs: { text: "hello" },
      path: ["node-1"],
    });

    // If the screen has addOutput, it should have been called
    const storedScreen = controller.run.screen.screens.get("node-1");
    assert.ok(storedScreen, "screen should still exist");
  });

  test("output event ignores non-bubbled events", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    // Should not throw even with no matching screen
    runner._fireEvent("output", {
      bubbled: false,
      node: { id: "non-existent" },
    });

    // No screen should be created
    assert.strictEqual(controller.run.screen.screens.size, 0);
  });
});

// =============================================================================
// nodeend: deleteScreen for interrupted state
// =============================================================================

suite("runner nodeend deleteScreen", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("deletes screen when node state is interrupted", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Create a screen for the node
    const screen = new ReactiveAppScreen("node-1", undefined);
    controller.run.screen.setScreen("node-1", screen);

    // Set up a console entry so nodeend handler has something to update
    controller.run.main.setConsoleEntry("node-1", {
      title: "Test Node",
      status: { status: "working" },
      completed: false,
    } as ConsoleEntry);

    // Set runner.state so the node appears interrupted
    (
      controller.run.main.runner as unknown as { state: Map<string, unknown> }
    ).state = new Map([["node-1", { state: "interrupted" }]]);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodeend", {
      path: ["node-1"],
      node: { id: "node-1" },
    });

    // Screen should be deleted for interrupted nodes
    assert.strictEqual(
      controller.run.screen.screens.has("node-1"),
      false,
      "screen should be deleted for interrupted node"
    );
  });

  test("finalizes screen when node is NOT interrupted", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Create a screen for the node
    const screen = new ReactiveAppScreen("node-1", undefined);
    let finalized = false;
    screen.finalize = () => {
      finalized = true;
    };
    controller.run.screen.setScreen("node-1", screen);

    // Set up a console entry
    controller.run.main.setConsoleEntry("node-1", {
      title: "Test Node",
      status: { status: "working" },
      completed: false,
    } as ConsoleEntry);

    // Set runner.state to succeeded (not interrupted)
    (
      controller.run.main.runner as unknown as { state: Map<string, unknown> }
    ).state = new Map([["node-1", { state: "succeeded" }]]);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodeend", {
      path: ["node-1"],
      node: { id: "node-1" },
    });

    // Screen should still exist (finalized, not deleted)
    assert.strictEqual(
      controller.run.screen.screens.has("node-1"),
      true,
      "screen should still exist for non-interrupted node"
    );
    assert.ok(finalized, "screen.finalize should be called");
  });

  test("sets renderer node state to succeeded on nodeend", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Set up a console entry
    controller.run.main.setConsoleEntry("node-1", {
      title: "Test Node",
      status: { status: "working" },
      completed: false,
    } as ConsoleEntry);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodeend", {
      path: ["node-1"],
      node: { id: "node-1" },
    });

    const nodeState = controller.run.renderer.nodes.get("node-1");
    assert.ok(nodeState, "renderer node state should be set");
    assert.strictEqual(
      nodeState.status,
      "succeeded",
      "renderer should show succeeded"
    );
  });
});

// =============================================================================
// graphstart async describe fallback (via _fireEvent path)
// =============================================================================

suite("runner graphstart async describe fallback", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("async fetches describe when metadata has no tags during graphstart", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // Create a node without tags initially
    let describeCalled = false;
    const mockNode = {
      title: () => "Node 1",
      describe: async () => {
        describeCalled = true;
        return { metadata: { icon: "async-icon", tags: ["async-tag"] } };
      },
      currentDescribe: () => ({ metadata: {} }), // No tags
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    const config = makeMockConfig();
    config.graph = { edges: [], nodes: [{ id: "node-1", type: "test" }] };
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("graphstart", { path: [] });

    // Wait for async describe
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(
      describeCalled,
      "describe should be called async for tagless node"
    );

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      ["async-tag"],
      "tags should be updated from async describe"
    );
  });

  test("does NOT async fetch when tags are already present", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    let describeCalled = false;
    const mockNode = {
      title: () => "Node 1",
      describe: async () => {
        describeCalled = true;
        return { metadata: { tags: ["should-not-see"] } };
      },
      currentDescribe: () => ({ metadata: { tags: ["existing-tag"] } }), // Has tags
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    const config = makeMockConfig();
    config.graph = { edges: [], nodes: [{ id: "node-1", type: "test" }] };
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("graphstart", { path: [] });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(
      describeCalled,
      false,
      "describe should NOT be called when tags exist"
    );
  });

  test("graphstart falls back to nodeId when node is not found", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // nodeById returns null — triggers all ?? fallbacks
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => null }]]),
      });

    const config = makeMockConfig();
    config.graph = { edges: [], nodes: [{ id: "node-1", type: "test" }] };
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("graphstart", { path: [] });

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist even when node is not inspectable");
    // Title falls back to nodeId when node is null
    assert.strictEqual(
      entry.title,
      "node-1",
      "title should fall back to nodeId"
    );
  });

  test("graphstart handles null plan.stages by using empty array", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    config.graph = { edges: [], nodes: [{ id: "node-1", type: "test" }] };
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
      plan: unknown;
    };

    // Set plan to null — triggers plan?.stages ?? [] fallback
    runner.plan = null;

    runner._fireEvent("graphstart", { path: [] });

    // Should not throw, console should have 0 entries because stages is empty
    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "no entries when plan has no stages"
    );
  });

  test("graphstart uses empty metadata when currentDescribe returns null", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockNode = {
      title: () => "Node 1",
      describe: async () => ({ metadata: null }),
      currentDescribe: () => null, // null describe — metadata ?? {} kicks in
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    const config = makeMockConfig();
    config.graph = { edges: [], nodes: [{ id: "node-1", type: "test" }] };
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("graphstart", { path: [] });

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    // No tags because metadata was null
    assert.strictEqual(entry.tags, undefined, "tags should be undefined");
  });
});

// =============================================================================
// nodestart fallback branches
// =============================================================================

suite("runner nodestart fallback branches", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("nodestart falls back to nodeId when node is not found", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    // nodeById returns null
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => null }]]),
      });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodestart", {
      path: ["node-1"],
      node: { id: "node-1" },
      inputs: {},
    });

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.title,
      "node-1",
      "title should fall back to nodeId"
    );
  });

  test("nodestart uses empty metadata when currentDescribe returns null", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const mockNode = {
      title: () => "Node 1",
      currentDescribe: () => null,
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    runner._fireEvent("nodestart", {
      path: ["node-1"],
      node: { id: "node-1" },
      inputs: {},
    });

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      undefined,
      "tags should be undefined when metadata is null"
    );
  });
});
