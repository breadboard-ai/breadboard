/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import * as RunActions from "../../../../src/sca/actions/run/run-actions.js";
import { STATUS } from "../../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { makeTestController, makeTestServices } from "../../triggers/utils.js";
import type { PrepareRunConfig } from "../../../../src/sca/actions/run/run-actions.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import type { ConsoleEntry, EditableGraph, HarnessRunner } from "@breadboard-ai/types";

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

describe("Run Actions", () => {
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

  // ===== Output-related event tests =====

  test("runner 'input' event sets input on controller", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    // Simulate input event with data
    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    runner._fireEvent("input", {
      node: { id: "input-node-1" },
      inputArguments: { schema: { type: "object" } },
    });

    assert.ok(controller.run.main.input, "input should be set");
    assert.strictEqual(
      controller.run.main.input?.id,
      "input-node-1",
      "input id should match"
    );
    assert.deepStrictEqual(
      controller.run.main.input?.schema,
      { type: "object" },
      "input schema should match"
    );
  });

  test("runner 'input' event handles missing node id", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };
    runner._fireEvent("input", {
      inputArguments: { schema: {} },
    });

    assert.ok(controller.run.main.input, "input should be set");
    assert.strictEqual(controller.run.main.input?.id, "", "input id should be empty string");
  });

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
    assert.strictEqual(controller.run.main.input, null, "input should be cleared");
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

    assert.strictEqual(controller.run.main.input, null, "input should be cleared after end");
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

  test("prepare calls connectToProject callback when provided", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    let called = false;
    let receivedRunner: unknown = null;
    let receivedSignal: AbortSignal | null = null;
    const config = makeMockConfig();
    config.connectToProject = (runner, signal) => {
      called = true;
      receivedRunner = runner;
      receivedSignal = signal;
    };
    RunActions.prepare(config);

    assert.ok(called, "connectToProject should be called");
    assert.ok(receivedRunner, "runner should be passed");
    assert.ok(receivedSignal, "signal should be passed");
  });
});

describe("mapLifecycleToRunStatus", () => {
  test("maps 'inactive' to 'inactive'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("inactive"), "inactive");
  });

  test("maps 'ready' to 'ready'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("ready"), "ready");
  });

  test("maps 'working' to 'working'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("working"), "working");
  });

  test("maps 'waiting' to 'working'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("waiting"), "working");
  });

  test("maps 'succeeded' to 'succeeded'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("succeeded"), "succeeded");
  });

  test("maps 'failed' to 'succeeded' (error styling handled separately)", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("failed"), "succeeded");
  });

  test("maps 'skipped' to 'skipped'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("skipped"), "skipped");
  });

  test("maps 'interrupted' to 'interrupted'", () => {
    assert.strictEqual(RunActions.mapLifecycleToRunStatus("interrupted"), "interrupted");
  });

  test("maps unknown state to 'inactive'", () => {
    // Cast to simulate unknown state
    assert.strictEqual(
      RunActions.mapLifecycleToRunStatus("unknown" as "inactive"),
      "inactive"
    );
  });
});

describe("syncConsoleFromRunner", () => {
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
    const { services } = makeTestServices({
      nodeMetadata: {
        "node-1": { title: "Title for node-1", icon: "star", tags: ["test"] },
        "node-2": { title: "Title for node-2", icon: "star", tags: ["test"] },
        "node-3": { title: "Title for node-3", icon: "star", tags: ["test"] },
      },
    });
    RunActions.bind({ controller, services });

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
    const { services } = makeTestServices({
      nodeMetadata: {
        "node-1": { title: "Node 1", tags: ["test"] },
      },
    });
    RunActions.bind({ controller, services });

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
    assert.strictEqual(entry.status?.status, "working", "status should be 'working'");
  });

  test("defaults to 'inactive' when node has no state", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices({
      nodeMetadata: {
        "node-1": { title: "Node 1", tags: ["test"] },
      },
    });
    RunActions.bind({ controller, services });

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
    assert.strictEqual(entry.status?.status, "inactive", "status should default to 'inactive'");
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

    // GraphStore returns failure
    (services.graphStore as unknown as { getByDescriptor: () => unknown }).getByDescriptor = () => ({ success: false });

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

    (services.graphStore as unknown as { getByDescriptor: () => unknown }).getByDescriptor = () => ({ success: true, result: {} });
    (services.graphStore as unknown as { inspect: () => unknown }).inspect = () => mockInspectable;

    RunActions.syncConsoleFromRunner();

    const entry = controller.run.main.console.get("missing-node");
    assert.ok(entry, "entry should exist");
    assert.strictEqual(entry.title, "missing-node", "title should fallback to nodeId");
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

    (services.graphStore as unknown as { getByDescriptor: () => unknown }).getByDescriptor = () => ({ success: true, result: {} });
    (services.graphStore as unknown as { inspect: () => unknown }).inspect = () => ({ nodeById: () => undefined });

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
