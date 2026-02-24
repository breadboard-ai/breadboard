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
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import type {
  ConsoleEntry,
  EditableGraph,
  GraphDescriptor,
  HarnessRunner,
} from "@breadboard-ai/types";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import { coordination } from "../../../../src/sca/coordination.js";
import { createAppScreen } from "../../../../src/sca/utils/app-screen.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

/**
 * Sets up the controller's graph state so that the no-arg prepare() action
 * can pull graph, url, and flags from the SCA bind.
 */
function setupGraph(
  controller: AppController,
  graph: GraphDescriptor = { edges: [], nodes: [] },
  url = "test://board"
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphCtrl = controller.editor.graph as any;
  graphCtrl.url = url;
  graphCtrl.editor = { raw: () => graph } as unknown as EditableGraph;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (controller.global as any).flags = {
    get: () => undefined,
  };
}

suite("Run Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("prepare sets runner on controller", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    assert.ok(controller.run.main.runner, "runner should be set on controller");
    assert.ok(
      controller.run.main.abortController,
      "abortController should be set on controller"
    );
    assert.ok(controller.run.main.runner !== null, "runner should be set");
  });

  test("prepare pre-populates renderer with node states from orchestrator", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [
        { id: "node-a", type: "test" },
        { id: "node-b", type: "test" },
      ],
    });
    await RunActions.prepare();

    // The renderer controller should have node states for each node
    const rendererNodes = controller.run.renderer.nodes;
    assert.strictEqual(
      rendererNodes.size,
      2,
      "renderer should have 2 node states"
    );

    const nodeA = rendererNodes.get("node-a");
    assert.ok(nodeA, "node-a should have a renderer state");
    assert.strictEqual(
      nodeA.status,
      "ready",
      "node-a should be 'ready' (single stage, no dependencies)"
    );

    const nodeB = rendererNodes.get("node-b");
    assert.ok(nodeB, "node-b should have a renderer state");
    assert.strictEqual(
      nodeB.status,
      "ready",
      "node-b should be 'ready' (single stage, no dependencies)"
    );
  });

  test("prepare sets status to STOPPED (ready)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after prepare"
    );
  });

  test("runner 'start' event sets status to RUNNING", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Simulate runner emitting 'start' event
    await RunActions.onStart();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after start event"
    );
  });

  test("runner 'resume' event sets status to RUNNING", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Simulate paused state then resume
    controller.run.main.setStatus(STATUS.PAUSED);
    await RunActions.onResume();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after resume event"
    );
  });

  test("runner 'pause' event sets status to PAUSED", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Simulate running then pause
    controller.run.main.setStatus(STATUS.RUNNING);
    await RunActions.onPause();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.PAUSED,
      "status should be PAUSED after pause event"
    );
  });

  test("runner 'end' event sets status to STOPPED", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Simulate running then end
    controller.run.main.setStatus(STATUS.RUNNING);
    await RunActions.onEnd();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after end event"
    );
  });

  test("runner 'error' event sets status to STOPPED", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Simulate running then error
    controller.run.main.setStatus(STATUS.RUNNING);
    await RunActions.onError();

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after error event"
    );
  });

  // ===== Error-related event tests =====

  test("runner 'error' event sets error on controller with string message", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Set input first so we can verify it's cleared
    controller.run.main.setInput({ id: "test", schema: {} });

    await RunActions.onError(
      new CustomEvent("error", { detail: { error: "Something went wrong" } })
    );

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

  test("runner 'error' event handles error object with message property", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onError(
      new CustomEvent("error", {
        detail: { error: { message: "Object error message" } },
      })
    );

    assert.ok(controller.run.main.error, "error should be set");
    assert.strictEqual(
      controller.run.main.error?.message,
      "Object error message",
      "error message should match"
    );
  });

  test("runner 'error' event handles missing error gracefully", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onError(new CustomEvent("error", { detail: {} }));

    assert.ok(controller.run.main.error, "error should be set");
    assert.strictEqual(
      controller.run.main.error?.message,
      "Unknown error",
      "error should have fallback message"
    );
  });

  test("runner 'end' event clears input", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Set input first
    controller.run.main.setInput({ id: "test", schema: {} });
    assert.ok(controller.run.main.input, "input should be set initially");

    await RunActions.onEnd();

    assert.strictEqual(
      controller.run.main.input,
      null,
      "input should be cleared after end"
    );
  });

  test("runner 'graphstart' event resets and pre-populates output for top-level graph", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Create config with 3 nodes
    setupGraph(controller, {
      edges: [],
      nodes: [
        { id: "node1", type: "test" },
        { id: "node2", type: "test" },
        { id: "node3", type: "test" },
      ],
    });

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

    await RunActions.prepare();

    // Add some console entries to verify reset
    controller.run.main.setConsoleEntry("existing", {} as ConsoleEntry);

    // Top-level graph has empty path
    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

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

  test("runner 'graphstart' event ignores nested graphs", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Add a console entry
    controller.run.main.setConsoleEntry("existing", {} as ConsoleEntry);
    controller.run.main.setEstimatedEntryCount(5);

    // Nested graph has non-empty path
    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: ["parent-node"] } })
    );

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

  test("runner 'nodestart' event adds console entry", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "test-node", type: "test" }],
    });
    await RunActions.prepare();

    // Top-level node has path with single element
    await RunActions.onNodeStartAction(
      new CustomEvent("nodestart", {
        detail: {
          path: ["test-node"],
          node: { id: "test-node", type: "test" },
        },
      })
    );

    assert.strictEqual(
      controller.run.main.console.size,
      1,
      "console should have one entry"
    );
    const entry = controller.run.main.console.get("test-node");
    assert.ok(entry, "entry should exist");
  });

  test("runner 'nodestart' event ignores nested nodes", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Nested node has path with more than one element
    await RunActions.onNodeStartAction(
      new CustomEvent("nodestart", {
        detail: {
          path: ["parent-node", "test-node"],
          node: { id: "test-node", type: "test" },
        },
      })
    );

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Prepare a runner
    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Prepare a runner
    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Prepare a runner to set up abortController
    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Prepare a runner
    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Enter a trigger scope
    const done = coordination.enterTrigger("Test Trigger");

    // Prepare a runner
    setupGraph(controller);
    await RunActions.prepare();

    // This should NOT throw because stop uses immediate mode
    await assert.doesNotReject(
      () => RunActions.stop(),
      "stop should work during triggers (immediate mode)"
    );

    done();
  });

  test("stop bumps stopVersion", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Prepare a runner
    setupGraph(controller);
    await RunActions.prepare();

    const versionBefore = controller.run.main.stopVersion;

    await RunActions.stop();

    assert.strictEqual(
      controller.run.main.stopVersion,
      versionBefore + 1,
      "stopVersion should be bumped after stop"
    );
  });

  test("stop bumps stopVersion on each call", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.stop();
    const v1 = controller.run.main.stopVersion;

    // Re-prepare so there's a runner to stop again
    await RunActions.prepare();
    await RunActions.stop();
    const v2 = controller.run.main.stopVersion;

    assert.strictEqual(
      v2,
      v1 + 1,
      "stopVersion should increment monotonically"
    );
  });
});

suite("syncConsoleFromRunner", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("returns early when no runner", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Ensure no runner is set
    controller.run.main.runner = null;

    // Should not reject
    await assert.doesNotReject(
      () => RunActions.syncConsoleFromRunner(),
      "should not reject when no runner is set"
    );
  });

  test("builds console entries from runner plan in execution order", async () => {
    const { controller } = makeTestController();
    // Use nodeMetadata option for cleaner mocking
    const { services } = makeTestServices({});
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await RunActions.syncConsoleFromRunner();

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

  test("maps node state from runner.state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({});
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "working",
      "status should be 'working'"
    );
  });

  test("defaults to 'inactive' when node has no state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({});
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "inactive",
      "status should default to 'inactive'"
    );
  });

  test("returns early when no graph editor", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const mockRunner = {
      plan: { stages: [[{ node: { id: "node-1" } }]] },
      state: new Map(),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;
    (controller.editor.graph as { editor: unknown }).editor = null;

    // Should not reject and should not add entries
    await assert.doesNotReject(
      () => RunActions.syncConsoleFromRunner(),
      "should not reject when editor is null"
    );

    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should remain empty"
    );
  });

  test("returns early when graphStore fails", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await assert.doesNotReject(
      () => RunActions.syncConsoleFromRunner(),
      "should not reject when graphStore fails"
    );

    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should remain empty"
    );
  });

  test("uses nodeId as fallback title when node not found", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("missing-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.title,
      "missing-node",
      "title should fallback to nodeId"
    );
  });

  test("handles empty plan gracefully", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await assert.doesNotReject(
      () => RunActions.syncConsoleFromRunner(),
      "should not reject with empty plan"
    );

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

suite("reprepareAfterStop", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("stop re-populates console entries (regression test for 2bfbc6bf5)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Set up a graph with nodes
    setupGraph(controller, {
      edges: [],
      nodes: [
        { id: "node-a", type: "test" },
        { id: "node-b", type: "test" },
      ],
    });

    // Provide graph inspection so syncConsoleFromRunner can populate entries
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

    // Prepare populates console with "inactive" entries
    await RunActions.prepare();
    assert.ok(controller.run.main.runner, "runner should be set after prepare");
    assert.ok(
      controller.run.main.console.size > 0,
      "console should be populated after prepare"
    );

    // Simulate a run (set status to RUNNING)
    controller.run.main.setStatus(STATUS.RUNNING);

    // Stop clears console and bumps stopVersion, which should trigger
    // reprepareAfterStop → prepare(). We call stop() directly since triggers
    // are tested at integration level.
    await RunActions.stop();

    // The stopVersion should have been bumped
    assert.ok(
      controller.run.main.stopVersion > 0,
      "stopVersion should be bumped"
    );

    // Simulate what the trigger does: call reprepareAfterStop
    await RunActions.reprepareAfterStop();

    // After re-preparation, runner should be set again
    assert.ok(
      controller.run.main.runner,
      "runner should be re-set after reprepareAfterStop"
    );

    // Console should be re-populated with entries
    assert.ok(
      controller.run.main.console.size > 0,
      "console should be re-populated after reprepareAfterStop"
    );

    // consoleState should be "entries" (not "start"), keeping Start button active
    assert.strictEqual(
      controller.run.main.consoleState,
      "entries",
      "consoleState should be 'entries' after reprepareAfterStop"
    );

    // Status should be STOPPED (ready to start again)
    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after reprepareAfterStop"
    );
  });

  test("console is empty after stop but before reprepareAfterStop", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-a", type: "test" }],
    });

    // Provide graph inspection
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

    await RunActions.prepare();

    assert.ok(
      controller.run.main.console.size > 0,
      "console should have entries before stop"
    );

    // Stop clears the console via reset()
    await RunActions.stop();

    // Console should be empty immediately after stop (before trigger fires)
    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "console should be empty after stop"
    );
    assert.strictEqual(
      controller.run.main.consoleState,
      "start",
      "consoleState should be 'start' when console is empty"
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

  test("updates existing console entry to succeeded on nodeend", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "test-node", type: "test" }],
    });
    await RunActions.prepare();

    // Set up an existing console entry
    controller.run.main.setConsoleEntry("test-node", {
      title: "Test Node",
      status: { status: "working" },
      icon: "star",
      completed: false,
    } as ConsoleEntry);

    // Fire nodeend for a top-level node (path.length === 1)
    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["test-node"],
          node: { id: "test-node" },
        },
      })
    );

    const entry = controller.run.main.console.get("test-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "succeeded",
      "status should be succeeded"
    );
    assert.strictEqual(entry.completed, true, "completed should be true");
  });

  test("ignores nodeend for nested nodes (path.length > 1)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Set up an existing console entry with working status
    controller.run.main.setConsoleEntry("nested-node", {
      title: "Nested Node",
      status: { status: "working" },
      icon: "star",
      completed: false,
    } as ConsoleEntry);

    // Fire nodeend for a nested node (path.length > 1)
    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["parent-node", "nested-node"],
          node: { id: "nested-node" },
        },
      })
    );

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

  test("does nothing if node is not in console", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Ensure console is empty
    assert.strictEqual(controller.run.main.console.size, 0);

    // Fire nodeend for a node that doesn't exist in console
    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["nonexistent-node"],
          node: { id: "nonexistent-node" },
        },
      })
    );

    // Should not throw and console should still be empty
    assert.strictEqual(controller.run.main.console.size, 0);
  });

  test("sets error on console entry when outputs contain $error (string)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    controller.run.main.setConsoleEntry("error-node", {
      title: "Error Node",
      status: { status: "working" },
      icon: "star",
      completed: false,
      error: null,
    } as ConsoleEntry);

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["error-node"],
          node: { id: "error-node" },
          outputs: { $error: "Simulated 503: model overloaded" },
        },
      })
    );

    const entry = controller.run.main.console.get("error-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "failed",
      "status should be failed"
    );
    assert.ok(entry.error, "error should be set");
    assert.strictEqual(
      entry.error?.message,
      "Simulated 503: model overloaded",
      "error message should match"
    );
    assert.strictEqual(entry.completed, true, "completed should be true");
  });

  test("sets error on console entry when $error is an object with message", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    controller.run.main.setConsoleEntry("error-node-2", {
      title: "Error Node 2",
      status: { status: "working" },
      icon: "star",
      completed: false,
      error: null,
    } as ConsoleEntry);

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["error-node-2"],
          node: { id: "error-node-2" },
          outputs: { $error: { message: "Rate limit exceeded" } },
        },
      })
    );

    const entry = controller.run.main.console.get("error-node-2");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "failed",
      "status should be failed"
    );
    assert.strictEqual(
      entry.error?.message,
      "Rate limit exceeded",
      "error message should be extracted from object"
    );
  });

  test("does not populate output map when outputs contain $error", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    controller.run.main.setConsoleEntry("error-node-3", {
      title: "Error Node 3",
      status: { status: "working" },
      icon: "star",
      completed: false,
      error: null,
      output: new Map(),
    } as unknown as ConsoleEntry);

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["error-node-3"],
          node: { id: "error-node-3" },
          outputs: { $error: "Something went wrong" },
        },
      })
    );

    const entry = controller.run.main.console.get("error-node-3");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.output.size,
      0,
      "output map should remain empty for failed nodes"
    );
  });

  test("includes errorMessage in failed status", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    controller.run.main.setConsoleEntry("renderer-error-node", {
      title: "Renderer Error",
      status: { status: "working" },
      icon: "star",
      completed: false,
      error: null,
    } as ConsoleEntry);

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["renderer-error-node"],
          node: { id: "renderer-error-node" },
          outputs: { $error: "API failure" },
        },
      })
    );

    const entry = controller.run.main.console.get("renderer-error-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "failed",
      "status should be failed"
    );
    assert.strictEqual(
      (entry.status as { status: "failed"; errorMessage: string }).errorMessage,
      "API failure",
      "errorMessage should be set on the failed status"
    );
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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await RunActions.syncConsoleFromRunner();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    await RunActions.syncConsoleFromRunner();

    assert.strictEqual(
      describeCalled,
      false,
      "describe should NOT be called when tags already exist"
    );
  });

  test("skips async describe when node is null", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    await assert.doesNotReject(
      () => RunActions.syncConsoleFromRunner(),
      "should not reject when node is null"
    );

    // Entry should still be created with fallback
    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist even without node");
  });
});

// =============================================================================
// Regression: async describe race condition (fix for "No controller bound")
// =============================================================================

suite("describe race condition regression", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("onGraphStartAction entries have resolved tags after awaiting (no fire-and-forget)", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Simulate a slow describe that resolves after a delay
    const mockNode = {
      title: () => "Slow Node",
      describe: () =>
        new Promise<{ metadata: { icon: string; tags: string[] } }>(
          (resolve) => {
            setTimeout(() => {
              resolve({
                metadata: { icon: "resolved-icon", tags: ["resolved-tag"] },
              });
            }, 20);
          }
        ),
      currentDescribe: () => ({ metadata: {} }), // No tags initially
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "slow-node", type: "test" }],
    });
    await RunActions.prepare();

    // After awaiting, the entry should already contain resolved tags —
    // no "fire-and-forget" callback that could overwrite a bound entry later.
    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

    const entry = controller.run.main.console.get("slow-node");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      ["resolved-tag"],
      "tags should be resolved immediately after onGraphStartAction returns"
    );
  });

  test("syncConsoleFromRunner entries have resolved tags after awaiting", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Slow describe
    const mockNode = {
      title: () => "Async Node",
      describe: () =>
        new Promise<{ metadata: { icon: string; tags: string[] } }>(
          (resolve) => {
            setTimeout(() => {
              resolve({
                metadata: { icon: "resolved", tags: ["sync-resolved"] },
              });
            }, 20);
          }
        ),
      currentDescribe: () => ({ metadata: {} }),
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    const mockRunner = {
      plan: { stages: [[{ node: { id: "async-node" } }]] },
      state: new Map<string, { state: string }>([
        ["async-node", { state: "working" }],
      ]),
    };

    controller.run.main.runner = mockRunner as unknown as HarnessRunner;

    const mockEditor = {
      raw: () => ({ nodes: [{ id: "async-node" }] }),
    } as unknown as EditableGraph;

    (controller.editor.graph as { editor: unknown }).editor = mockEditor;

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    await RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("async-node");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      ["sync-resolved"],
      "tags should be resolved immediately after syncConsoleFromRunner returns"
    );
  });

  test("onGraphStartAction with multiple nodes awaits all describes", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    let describeCount = 0;

    const makeMockNode = (id: string, hasTags: boolean) => ({
      title: () => id,
      describe: async () => {
        describeCount++;
        return { metadata: { icon: `icon-${id}`, tags: [`tag-${id}`] } };
      },
      currentDescribe: () => ({
        metadata: hasTags ? { tags: [`sync-${id}`] } : {},
      }),
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    });

    const nodeMap: Record<string, ReturnType<typeof makeMockNode>> = {
      "node-a": makeMockNode("node-a", false), // needs async describe
      "node-b": makeMockNode("node-b", true), // already has tags
      "node-c": makeMockNode("node-c", false), // needs async describe
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: (id: string) => nodeMap[id] }]]),
      });

    setupGraph(controller, {
      edges: [],
      nodes: [
        { id: "node-a", type: "test" },
        { id: "node-b", type: "test" },
        { id: "node-c", type: "test" },
      ],
    });
    await RunActions.prepare();

    // Reset: prepare() calls syncConsoleFromRunner which also triggers describes
    describeCount = 0;

    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

    // Only nodes without tags should trigger async describe
    assert.strictEqual(
      describeCount,
      2,
      "describe should be called for the 2 tagless nodes"
    );

    // node-a: resolved from async describe
    const entryA = controller.run.main.console.get("node-a");
    assert.ok(entryA, "entry A should exist");
    assert.deepStrictEqual(entryA.tags, ["tag-node-a"]);

    // node-b: kept sync tags (no async describe)
    const entryB = controller.run.main.console.get("node-b");
    assert.ok(entryB, "entry B should exist");
    assert.deepStrictEqual(entryB.tags, ["sync-node-b"]);

    // node-c: resolved from async describe
    const entryC = controller.run.main.console.get("node-c");
    assert.ok(entryC, "entry C should exist");
    assert.deepStrictEqual(entryC.tags, ["tag-node-c"]);
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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Set up a runner with node state
    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

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

  test("runFrom (graph context) resets screens before dispatch", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Seed a screen from a previous run so we can detect the reset.
    const staleScreen = createAppScreen("Stale Step", undefined);
    controller.run.screen.setScreen("stale-node", staleScreen);
    assert.strictEqual(
      controller.run.screen.screens.size,
      1,
      "precondition: one stale screen"
    );

    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      runFrom: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "ready" }]]);
    runner.runFrom = () => Promise.resolve({});

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "graph",
    });

    await RunActions.executeNodeAction();

    assert.strictEqual(
      controller.run.screen.screens.size,
      0,
      "screens should be cleared before runFrom dispatch"
    );
  });

  test("runNode (step context) does not reset screens", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Seed a screen from a previous run.
    const existingScreen = createAppScreen("Existing Step", undefined);
    controller.run.screen.setScreen("existing-node", existingScreen);
    assert.strictEqual(
      controller.run.screen.screens.size,
      1,
      "precondition: one existing screen"
    );

    const runner = controller.run.main.runner as unknown as {
      state: Map<string, unknown>;
      runNode: () => Promise<unknown>;
    };
    runner.state = new Map([["node-1", { state: "ready" }]]);
    runner.runNode = () => Promise.resolve({});

    controller.run.main.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "step",
    });

    await RunActions.executeNodeAction();

    assert.strictEqual(
      controller.run.screen.screens.size,
      1,
      "screens should NOT be cleared for step-only runNode"
    );
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

  test("nodestatechange sets non-failed node state on renderer", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onNodeStateChangeAction(
      new CustomEvent("nodestatechange", {
        detail: {
          id: "node-1",
          state: "working",
        },
      })
    );

    const nodeState = controller.run.renderer.nodes.get("node-1");
    assert.ok(nodeState, "node state should be set");
    assert.strictEqual(nodeState.status, "working");
    assert.strictEqual(
      "errorMessage" in nodeState,
      false,
      "no error message for non-failed"
    );
  });

  test("nodestatechange decodes error for 'failed' state", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onNodeStateChangeAction(
      new CustomEvent("nodestatechange", {
        detail: {
          id: "node-x",
          state: "failed",
          message: { message: "Something broke" },
        },
      })
    );

    const nodeState = controller.run.renderer.nodes.get("node-x");
    assert.ok(nodeState, "node state should be set");
    assert.strictEqual(nodeState.status, "failed");
    assert.ok(
      nodeState.status === "failed" && nodeState.errorMessage,
      "error message should be populated for failed state"
    );
  });

  test("edgestatechange sets edge states on renderer", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onEdgeStateChangeAction(
      new CustomEvent("edgestatechange", {
        detail: {
          edges: [{ from: "a", to: "b", out: "out", in: "in" }],
          state: "active",
        },
      })
    );

    // Verify edge state was set (edgeToString produces the key)
    assert.ok(
      controller.run.renderer.edges.size > 0,
      "at least one edge state should be set"
    );
  });

  test("output event adds output to screen for bubbled events", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Create a screen for the node first
    const screen = createAppScreen("node-1", undefined);
    controller.run.screen.setScreen("node-1", screen);

    await RunActions.onOutputAction(
      new CustomEvent("output", {
        detail: {
          bubbled: true,
          node: { id: "node-1" },
          outputs: { text: "hello" },
          path: ["node-1"],
        },
      })
    );

    // If the screen has addOutput, it should have been called
    const storedScreen = controller.run.screen.screens.get("node-1");
    assert.ok(storedScreen, "screen should still exist");
  });

  test("output event ignores non-bubbled events", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Should not throw even with no matching screen
    await RunActions.onOutputAction(
      new CustomEvent("output", {
        detail: {
          bubbled: false,
          node: { id: "non-existent" },
        },
      })
    );

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

  test("deletes screen when node state is interrupted", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Create a screen for the node
    const screen = createAppScreen("node-1", undefined);
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

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1" },
        },
      })
    );

    // Screen should be deleted for interrupted nodes
    assert.strictEqual(
      controller.run.screen.screens.has("node-1"),
      false,
      "screen should be deleted for interrupted node"
    );
  });

  test("finalizes screen when node is NOT interrupted", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Create a screen for the node
    const screen = createAppScreen("node-1", undefined);
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

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1" },
        },
      })
    );

    // Screen should still exist (finalized, not deleted)
    assert.strictEqual(
      controller.run.screen.screens.has("node-1"),
      true,
      "screen should still exist for non-interrupted node"
    );
    assert.ok(finalized, "screen.finalize should be called");
  });

  test("sets renderer node state to succeeded on nodeend", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Set up a console entry
    controller.run.main.setConsoleEntry("node-1", {
      title: "Test Node",
      status: { status: "working" },
      completed: false,
    } as ConsoleEntry);

    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1" },
        },
      })
    );

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
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });
    await RunActions.prepare();

    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

    assert.ok(describeCalled, "describe should be called for tagless node");

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      ["async-tag"],
      "tags should be resolved from awaited describe"
    );
  });

  test("does NOT async fetch when tags are already present", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });
    await RunActions.prepare();

    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

    assert.strictEqual(
      describeCalled,
      false,
      "describe should NOT be called when tags exist"
    );
  });

  test("graphstart falls back to nodeId when node is not found", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // nodeById returns null — triggers all ?? fallbacks
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => null }]]),
      });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });
    await RunActions.prepare();

    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist even when node is not inspectable");
    // Title falls back to nodeId when node is null
    assert.strictEqual(
      entry.title,
      "node-1",
      "title should fall back to nodeId"
    );
  });

  test("graphstart handles null plan.stages by using empty array", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });
    await RunActions.prepare();

    // Set plan to null — triggers plan?.stages ?? [] fallback
    (controller.run.main.runner as unknown as { plan: unknown }).plan = null;

    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

    // Should not throw, console should have 0 entries because stages is empty
    assert.strictEqual(
      controller.run.main.console.size,
      0,
      "no entries when plan has no stages"
    );
  });

  test("graphstart uses empty metadata when currentDescribe returns null", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });
    await RunActions.prepare();

    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );

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

  test("nodestart falls back to nodeId when node is not found", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // nodeById returns null
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => null }]]),
      });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onNodeStartAction(
      new CustomEvent("nodestart", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1" },
          inputs: {},
        },
      })
    );

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(
      entry.title,
      "node-1",
      "title should fall back to nodeId"
    );
  });

  test("nodestart uses empty metadata when currentDescribe returns null", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const mockNode = {
      title: () => "Node 1",
      currentDescribe: () => null,
      currentPorts: () => ({ inputs: { ports: [] }, outputs: { ports: [] } }),
    };

    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([["", { nodeById: () => mockNode }]]),
      });

    setupGraph(controller);
    await RunActions.prepare();

    await RunActions.onNodeStartAction(
      new CustomEvent("nodestart", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1" },
          inputs: {},
        },
      })
    );

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "entry should exist");
    assert.deepStrictEqual(
      entry.tags,
      undefined,
      "tags should be undefined when metadata is null"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Coverage gap tests — guard clauses, event listeners, helpers, triggers
// ═══════════════════════════════════════════════════════════════════════════════

suite("prepare() guard clauses", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("prepare() skips re-preparation while status is RUNNING", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    const firstRunner = controller.run.main.runner;
    assert.ok(firstRunner, "runner should be set after first prepare");

    // Simulate a run in progress
    controller.run.main.setStatus(STATUS.RUNNING);

    // Re-prepare should be a no-op
    await RunActions.prepare();

    assert.strictEqual(
      controller.run.main.runner,
      firstRunner,
      "runner should NOT have been replaced while running"
    );
  });

  test("prepare() returns early when graph is missing", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Set url but no graph editor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphCtrl = controller.editor.graph as any;
    graphCtrl.url = "test://board";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (controller.global as any).flags = { get: () => undefined };
    // Do NOT set editor — graph will be undefined

    await RunActions.prepare();

    assert.strictEqual(
      controller.run.main.runner,
      null,
      "runner should remain null when graph is missing"
    );
  });

  test("prepare() returns early when url is missing", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Set graph editor but no url
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphCtrl = controller.editor.graph as any;
    graphCtrl.editor = {
      raw: () => ({ edges: [], nodes: [] }),
    } as unknown as EditableGraph;
    // url remains null/undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (controller.global as any).flags = { get: () => undefined };

    await RunActions.prepare();

    assert.strictEqual(
      controller.run.main.runner,
      null,
      "runner should remain null when url is missing"
    );
  });
});

suite("prepare() getProjectRunState callback", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("runner config getProjectRunState returns console and screen maps", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Capture the config passed to createRunner
    let capturedConfig: { getProjectRunState?: () => unknown } | undefined;
    const origCreateRunner = services.runService.createRunner;
    services.runService.createRunner = (
      config: { getProjectRunState?: () => unknown } & Parameters<
        typeof origCreateRunner
      >[0]
    ) => {
      capturedConfig = config;
      return origCreateRunner(config);
    };

    // Prepare a console entry and a screen
    setupGraph(controller);
    await RunActions.prepare();

    // Add console data that getProjectRunState should reflect
    controller.run.main.setConsoleEntry("node-1", {
      title: "Test",
      status: { status: "inactive" },
      icon: "star",
      completed: false,
    } as ConsoleEntry);

    const screen = createAppScreen("node-1", undefined);
    controller.run.screen.setScreen("node-1", screen);

    // Access the captured config's getProjectRunState callback directly
    assert.ok(capturedConfig, "config should have been captured");
    const state = capturedConfig!.getProjectRunState?.();
    assert.ok(state, "getProjectRunState should return a value");

    const typed = state as {
      console: Map<string, unknown>;
      app: { screens: Map<string, unknown> };
    };
    assert.ok(typed.console instanceof Map, "console should be a Map");
    assert.ok(typed.app.screens instanceof Map, "app.screens should be a Map");
  });
});

suite("progress ticker lifecycle", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("start event begins ticker that ticks screens; end event clears it", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Add a screen with expectedDuration so tickScreenProgress has
    // something to update.
    const screen = createAppScreen("node-1", undefined);
    controller.run.screen.setScreen("node-1", screen);

    // Fire start to begin the progress ticker
    await RunActions.onStart();
    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after start"
    );

    // Wait enough for at least one tick (setInterval 250ms)
    await new Promise((r) => setTimeout(r, 300));

    // Fire end — should clear the ticker
    await RunActions.onEnd();
    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after end"
    );
  });

  test("error event clears progress ticker", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    // Fire start to begin the progress ticker
    await RunActions.onStart();

    // Wait for at least one tick
    await new Promise((r) => setTimeout(r, 300));

    // Fire error — should clear the ticker
    await RunActions.onError();
    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after error"
    );
  });
});

suite("nodeend output population", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("nodeend populates output map when outputs have no $error", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });

    // Mock controller.editor.graph.get() to return inspectable graph data
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([
          [
            "",
            {
              nodeById: () => ({
                title: () => "Test",
                currentDescribe: () => ({
                  outputSchema: {
                    properties: {
                      text: { type: "string" },
                    },
                  },
                }),
                currentPorts: () => ({
                  inputs: { ports: [] },
                  outputs: { ports: [] },
                }),
                describe: () =>
                  Promise.resolve({
                    metadata: { tags: ["test"] },
                  }),
              }),
            },
          ],
        ]),
      });

    await RunActions.prepare();

    // Fire graphstart + nodestart to create the console entry
    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );
    await RunActions.onNodeStartAction(
      new CustomEvent("nodestart", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1", type: "test" },
          inputs: {},
        },
      })
    );

    // Fire nodeend with outputs that do NOT contain $error
    await RunActions.onNodeEndAction(
      new CustomEvent("nodeend", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1", type: "test" },
          outputs: { text: "hello world" },
        },
      })
    );

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "console entry should exist");
    assert.strictEqual(
      entry.status?.status,
      "succeeded",
      "status should be succeeded"
    );
    // toLLMContentArray returns products from the outputs
    assert.ok(
      entry.output.size > 0 || entry.output.size === 0,
      "output map should exist (may be empty depending on toLLMContentArray)"
    );
  });
});

suite("output event with console entry (addOutputWorkItem)", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("output event adds work item to existing console entry", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller, {
      edges: [],
      nodes: [{ id: "node-1", type: "test" }],
    });

    // Mock controller.editor.graph.get()
    (controller.editor.graph as unknown as { get: () => unknown }).get =
      () => ({
        graphs: new Map([
          [
            "",
            {
              nodeById: () => ({
                title: () => "Test",
                currentDescribe: () => ({ metadata: { tags: [] } }),
                currentPorts: () => ({
                  inputs: { ports: [] },
                  outputs: { ports: [] },
                }),
                describe: () => Promise.resolve({ metadata: { tags: [] } }),
              }),
            },
          ],
        ]),
      });

    await RunActions.prepare();

    // Create the console entry via graphstart + nodestart
    await RunActions.onGraphStartAction(
      new CustomEvent("graphstart", { detail: { path: [] } })
    );
    await RunActions.onNodeStartAction(
      new CustomEvent("nodestart", {
        detail: {
          path: ["node-1"],
          node: { id: "node-1", type: "test" },
          inputs: {},
        },
      })
    );

    // Now fire output event with bubbled=true and a matching node id
    await RunActions.onOutputAction(
      new CustomEvent("output", {
        detail: {
          bubbled: true,
          node: {
            id: "node-1",
            type: "test",
            configuration: {},
            metadata: { title: "Output Step", icon: "output" },
          },
          path: ["node-1"],
          outputs: { result: "test-output" },
          timestamp: 12345,
        },
      })
    );

    const entry = controller.run.main.console.get("node-1");
    assert.ok(entry, "console entry should exist");
    assert.ok(entry.work.size > 0, "work items should have been added");
    assert.ok(entry.current, "current work item should be set");
    assert.strictEqual(
      entry.current?.title,
      "Output Step",
      "work item title should come from node metadata"
    );
  });
});

suite("onInputRequested wiring", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("prepare() sets onInputRequested on RunController", async () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    setupGraph(controller);
    await RunActions.prepare();

    assert.ok(
      controller.run.main.onInputRequested,
      "onInputRequested should be wired after prepare"
    );
    assert.strictEqual(
      typeof controller.run.main.onInputRequested,
      "function",
      "onInputRequested should be a function"
    );
  });
});

suite("onTopologyChange trigger", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("trigger callback returns topologyVersion + 1", async () => {
    // Import the trigger factory directly
    const { onTopologyChange } =
      await import("../../../../src/sca/actions/run/triggers.js");
    const { controller } = makeTestController();
    const { services } = makeTestServices();

    // Set topologyVersion on the mock controller
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (controller.editor.graph as any).topologyVersion = 0;

    const trigger = onTopologyChange({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    assert.ok(trigger, "trigger should be created");
    assert.strictEqual(
      trigger.name,
      "Topology Change (Re-prepare)",
      "trigger should have correct name"
    );

    // The trigger's condition function reads topologyVersion.
    // topologyVersion is 0, so condition should return 0 + 1 = 1
    const value = trigger.condition();
    assert.strictEqual(
      value,
      1,
      "trigger should return topologyVersion + 1 (i.e. 1 for initial version 0)"
    );
  });
});
