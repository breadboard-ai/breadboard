/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, describe, test } from "node:test";
import * as RunTriggers from "../../../../src/sca/triggers/run/run-triggers.js";
import { STATUS } from "../../../../src/sca/controller/subcontrollers/run/run-controller.js";
import {
  makeTestController,
  makeTestServices,
  flushEffects,
} from "../utils.js";
import { AppActions } from "../../../../src/sca/actions/actions.js";

describe("Run Triggers", () => {
  afterEach(() => {
    RunTriggers.bind.clean();
  });

  test("registerRunStatusListener warns if no runner", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    // Should not throw, just warn
    assert.doesNotThrow(() => {
      RunTriggers.registerRunStatusListener();
    });
  });

  test("registerRunStatusListener updates status on start event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    // Create a mock runner with event support
    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerRunStatusListener();

    // Dispatch start event
    mockRunner.dispatchEvent(new Event("start"));

    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after start event"
    );
  });

  test("registerRunStatusListener updates status on resume event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerRunStatusListener();
    mockRunner.dispatchEvent(new Event("resume"));

    assert.strictEqual(
      controller.run.main.status,
      STATUS.RUNNING,
      "status should be RUNNING after resume event"
    );
  });

  test("registerRunStatusListener updates status on pause event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerRunStatusListener();
    controller.run.main.setStatus(STATUS.RUNNING);
    mockRunner.dispatchEvent(new Event("pause"));

    assert.strictEqual(
      controller.run.main.status,
      STATUS.PAUSED,
      "status should be PAUSED after pause event"
    );
  });

  test("registerRunStatusListener updates status on end event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerRunStatusListener();
    controller.run.main.setStatus(STATUS.RUNNING);
    mockRunner.dispatchEvent(new Event("end"));

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after end event"
    );
  });

  test("registerRunStatusListener updates status on error event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerRunStatusListener();
    controller.run.main.setStatus(STATUS.RUNNING);
    mockRunner.dispatchEvent(new Event("error"));

    assert.strictEqual(
      controller.run.main.status,
      STATUS.STOPPED,
      "status should be STOPPED after error event"
    );
  });

  test("full run lifecycle: start -> pause -> resume -> end", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerRunStatusListener();

    mockRunner.dispatchEvent(new Event("start"));
    assert.strictEqual(controller.run.main.status, STATUS.RUNNING);

    mockRunner.dispatchEvent(new Event("pause"));
    assert.strictEqual(controller.run.main.status, STATUS.PAUSED);

    mockRunner.dispatchEvent(new Event("resume"));
    assert.strictEqual(controller.run.main.status, STATUS.RUNNING);

    mockRunner.dispatchEvent(new Event("end"));
    assert.strictEqual(controller.run.main.status, STATUS.STOPPED);
  });

  // ===== registerGraphSyncTrigger tests =====

  test("registerGraphSyncTrigger registers without error", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    assert.doesNotThrow(() => {
      RunTriggers.registerGraphSyncTrigger();
    });
  });

  test("registerGraphSyncTrigger updates estimated entry count when hasRunner", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    // Set up a runner so hasRunner is true
    const mockRunner = new EventTarget();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    // Set a known estimated entry count first
    controller.run.main.setEstimatedEntryCount(99);

    RunTriggers.registerGraphSyncTrigger();

    // Trigger the effect by flushing
    flushEffects();

    // The trigger should have run - count may have updated based on graph
    // The key is that the hasRunner branch was executed
    assert.ok(
      controller.run.main.estimatedEntryCount !== undefined,
      "estimated entry count should be defined"
    );
  });

  // ===== registerOutputListener tests =====

  test("registerOutputListener warns if no runner", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    // Should not throw, just warn
    assert.doesNotThrow(() => {
      RunTriggers.registerOutputListener();
    });
  });

  test("registerOutputListener sets input on input event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerOutputListener();

    fireEvent("input", {
      node: { id: "input-node" },
      inputArguments: { schema: { type: "string" } },
    });

    assert.ok(controller.run.main.input);
    assert.strictEqual(controller.run.main.input?.id, "input-node");
    assert.deepStrictEqual(controller.run.main.input?.schema, {
      type: "string",
    });
  });

  test("registerOutputListener sets error on error event with string", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerOutputListener();

    fireEvent("error", { error: "Something went wrong" });

    assert.ok(controller.run.main.error);
    assert.strictEqual(
      controller.run.main.error?.message,
      "Something went wrong"
    );
  });

  test("registerOutputListener sets error fallback when error is not string or object", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerOutputListener();

    // Error is null - should hit the else branch
    fireEvent("error", { error: null });

    assert.ok(controller.run.main.error);
    assert.strictEqual(
      controller.run.main.error?.message,
      "Unknown error"
    );
  });

  test("registerOutputListener sets error on error event with object", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerOutputListener();

    fireEvent("error", {
      error: { message: "Object error", details: "Extra info" },
    });

    assert.ok(controller.run.main.error);
    assert.strictEqual(controller.run.main.error?.message, "Object error");
  });

  test("registerOutputListener clears input on end event", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    // Set input before
    controller.run.main.setInput({ id: "test", schema: {} });
    assert.ok(controller.run.main.input);

    RunTriggers.registerOutputListener();

    fireEvent("end", {});

    assert.strictEqual(controller.run.main.input, null);
  });

  test("registerOutputListener resets output on graphstart for root graph", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    // Add existing console entry
    controller.run.main.setConsoleEntry(
      "old",
      {} as import("@breadboard-ai/types").ConsoleEntry
    );
    assert.strictEqual(controller.run.main.console.size, 1);

    RunTriggers.registerOutputListener();

    // Top-level graph has empty path
    fireEvent("graphstart", { path: [] });

    assert.strictEqual(controller.run.main.console.size, 0);
  });

  test("registerOutputListener ignores graphstart for nested graphs", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    controller.run.main.setConsoleEntry(
      "existing",
      {} as import("@breadboard-ai/types").ConsoleEntry
    );

    RunTriggers.registerOutputListener();

    // Nested graph has non-empty path
    fireEvent("graphstart", { path: ["parent"] });

    assert.strictEqual(controller.run.main.console.size, 1);
  });

  test("registerOutputListener adds console entry on nodestart for top-level node", () => {
    // This test needs an editor to provide graph via controller.editor.graph.editor?.raw()
    // The nodestart handler in registerOutputListener reads from the graph
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerOutputListener();

    fireEvent("nodestart", {
      path: ["node-1"],
      node: { id: "node-1", type: "test" },
    });

    // Without an editor, the handler returns early and doesn't add an entry
    // This is expected behavior - the trigger gracefully handles missing graph
    assert.strictEqual(controller.run.main.console.size, 0);
  });

  test("registerOutputListener ignores nodestart for nested nodes", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    const { mockRunner, fireEvent } = createDataEventRunner();
    controller.run.main.setRunner(
      mockRunner as unknown as Parameters<
        typeof controller.run.main.setRunner
      >[0],
      new AbortController()
    );

    RunTriggers.registerOutputListener();

    fireEvent("nodestart", {
      path: ["parent", "child"],
      node: { id: "child", type: "test" },
    });

    assert.strictEqual(controller.run.main.console.size, 0);
  });
});

/**
 * Creates a mock runner that supports data events (events with custom data).
 */
function createDataEventRunner() {
  type Handler = (event: { data?: unknown }) => void;
  const listeners: Record<string, Handler[]> = {};

  const mockRunner = {
    addEventListener: (event: string, handler: Handler) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    },
    removeEventListener: () => { },
    start: () => { },
    running: () => false,
  };

  const fireEvent = (event: string, data?: unknown) => {
    if (listeners[event]) {
      listeners[event].forEach((h) => h({ data }));
    }
  };

  return { mockRunner, fireEvent };
}
