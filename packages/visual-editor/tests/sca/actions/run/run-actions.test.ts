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

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    // First fire nodestart to populate the path-to-id cache
    runner._fireEvent("nodestart", {
      path: [0],
      node: { id: "parent-node", type: "test" },
    });

    // Simulate input event with data (includes path for parent lookup)
    runner._fireEvent("input", {
      path: [0],
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

    // Verify work item was added to parent console entry
    const parentEntry = controller.run.main.console.get("parent-node");
    assert.ok(parentEntry, "parent console entry should exist");
    assert.ok(parentEntry!.work.size > 0, "work items should be added to parent");
  });

  test("runner 'input' event handles missing path gracefully", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunActions.bind({ controller, services });

    const config = makeMockConfig();
    RunActions.prepare(config);

    const runner = controller.run.main.runner! as unknown as {
      _fireEvent: (e: string, data?: unknown) => void;
    };

    // Input event without path should warn but not crash
    // (path is required to find parent, so input won't be added to any console entry)
    runner._fireEvent("input", {
      path: [999], // Path that doesn't match any nodestart
      node: { id: "orphan-input" },
      inputArguments: { schema: {} },
    });

    // Input should still be set on controller (for the floating input component)
    assert.ok(controller.run.main.input, "input should be set");
    assert.strictEqual(controller.run.main.input?.id, "orphan-input", "input id should match");
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
    controller.run.main.setConsoleEntry("existing", {} as import("@breadboard-ai/types").ConsoleEntry);

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
    controller.run.main.setConsoleEntry("existing", {} as import("@breadboard-ai/types").ConsoleEntry);
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
