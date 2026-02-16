/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import {
  RunController,
  STATUS,
} from "../../../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import type {
  ConsoleEntry,
  HarnessRunner,
  RunError,
  Schema,
} from "@breadboard-ai/types";

/**
 * Tests for the RunController.
 *
 * The RunController owns run status, tracking whether the board
 * is stopped, running, or paused.
 */
suite("RunController status management", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("status defaults to STOPPED", async () => {
    const controller = new RunController("RunTest_1", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.status, STATUS.STOPPED);
  });

  test("setStatus updates status", async () => {
    const controller = new RunController("RunTest_2", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;

    assert.strictEqual(controller.status, STATUS.RUNNING);
  });

  test("reset does not change status", async () => {
    const controller = new RunController("RunTest_3", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    // reset() clears output state but does not modify status
    assert.strictEqual(controller.status, STATUS.RUNNING);
  });
});

suite("RunController status transitions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("simulates full run lifecycle: stopped -> running -> paused -> running -> stopped", async () => {
    const controller = new RunController("RunTest_7", "RunController");
    await controller.isHydrated;

    // Start: stopped
    assert.strictEqual(controller.status, STATUS.STOPPED);

    // User starts run
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.status, STATUS.RUNNING);

    // Run pauses for input
    controller.setStatus(STATUS.PAUSED);
    await controller.isSettled;
    assert.strictEqual(controller.status, STATUS.PAUSED);

    // User provides input, run resumes
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.status, STATUS.RUNNING);

    // Run completes
    controller.setStatus(STATUS.STOPPED);
    await controller.isSettled;
    assert.strictEqual(controller.status, STATUS.STOPPED);
  });
});

suite("RunController console management", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("console defaults to empty Map", async () => {
    const controller = new RunController("RunTest_console_1", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.console.size, 0);
    assert.strictEqual(controller.consoleState, "start");
  });

  test("setConsoleEntry adds entry to console", async () => {
    const controller = new RunController("RunTest_console_2", "RunController");
    await controller.isHydrated;

    const mockEntry = { id: "node-1" } as unknown as ConsoleEntry;
    controller.setConsoleEntry("node-1", mockEntry);
    await controller.isSettled;

    assert.strictEqual(controller.console.size, 1);
    assert.deepStrictEqual(controller.console.get("node-1"), mockEntry);
    assert.strictEqual(controller.consoleState, "entries");
  });

  test("reset clears console", async () => {
    const controller = new RunController("RunTest_console_3", "RunController");
    await controller.isHydrated;

    const mockEntry = { id: "node-1" } as unknown as ConsoleEntry;
    controller.setConsoleEntry("node-1", mockEntry);
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.console.size, 0);
    assert.strictEqual(controller.consoleState, "start");
  });
});

suite("RunController input handling", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("input defaults to null", async () => {
    const controller = new RunController("RunTest_input_1", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.input, null);
  });

  test("setInput sets input", async () => {
    const controller = new RunController("RunTest_input_2", "RunController");
    await controller.isHydrated;

    const mockInput = { id: "input-node", schema: { type: "object" } };
    controller.setInput(mockInput);
    await controller.isSettled;

    assert.deepStrictEqual(controller.input, mockInput);
  });

  test("clearInput clears input", async () => {
    const controller = new RunController("RunTest_input_3", "RunController");
    await controller.isHydrated;

    const mockInput = { id: "input-node", schema: { type: "object" } };
    controller.setInput(mockInput);
    await controller.isSettled;

    controller.clearInput();
    await controller.isSettled;

    assert.strictEqual(controller.input, null);
  });

  test("reset clears input", async () => {
    const controller = new RunController("RunTest_input_4", "RunController");
    await controller.isHydrated;

    const mockInput = { id: "input-node", schema: { type: "object" } };
    controller.setInput(mockInput);
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.input, null);
  });
});

suite("RunController error handling", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("error defaults to null", async () => {
    const controller = new RunController("RunTest_error_1", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.error, null);
  });

  test("setError sets error", async () => {
    const controller = new RunController("RunTest_error_2", "RunController");
    await controller.isHydrated;

    const mockError: RunError = { message: "Test error" };
    controller.setError(mockError);
    await controller.isSettled;

    assert.deepStrictEqual(controller.error, mockError);
  });

  test("dismissError clears error", async () => {
    const controller = new RunController("RunTest_error_3", "RunController");
    await controller.isHydrated;

    const mockError: RunError = { message: "Test error" };
    controller.setError(mockError);
    await controller.isSettled;

    controller.dismissError();
    await controller.isSettled;

    assert.strictEqual(controller.error, null);
  });

  test("dismissError with nodeId adds to dismissedErrors", async () => {
    const controller = new RunController("RunTest_error_4", "RunController");
    await controller.isHydrated;

    const mockError: RunError = { message: "Test error" };
    controller.setError(mockError);
    await controller.isSettled;

    controller.dismissError("failed-node");
    await controller.isSettled;

    assert.strictEqual(controller.error, null);
    assert.strictEqual(controller.dismissedErrors.has("failed-node"), true);
  });

  test("reset clears error and dismissedErrors", async () => {
    const controller = new RunController("RunTest_error_5", "RunController");
    await controller.isHydrated;

    controller.setError({ message: "Error" });
    controller.dismissError("node-1");
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.error, null);
    assert.strictEqual(controller.dismissedErrors.size, 0);
  });
});

suite("RunController progress tracking", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("estimatedEntryCount defaults to 0", async () => {
    const controller = new RunController("RunTest_progress_1", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.estimatedEntryCount, 0);
  });

  test("setEstimatedEntryCount sets the estimate", async () => {
    const controller = new RunController("RunTest_progress_2", "RunController");
    await controller.isHydrated;

    controller.setEstimatedEntryCount(10);
    await controller.isSettled;

    assert.strictEqual(controller.estimatedEntryCount, 10);
  });

  test("estimatedEntryCount returns max of estimate and console size", async () => {
    const controller = new RunController("RunTest_progress_3", "RunController");
    await controller.isHydrated;

    controller.setEstimatedEntryCount(5);

    // Add more entries than estimate
    for (let i = 0; i < 8; i++) {
      controller.setConsoleEntry(`node-${i}`, {
        id: `node-${i}`,
      } as unknown as ConsoleEntry);
    }
    await controller.isSettled;

    // Should return the larger value (console size)
    assert.strictEqual(controller.estimatedEntryCount, 8);
  });

  test("progress is 0 when no run (stopped, empty console)", async () => {
    const controller = new RunController("RunTest_progress_4", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.progress, 0);
  });

  test("progress computed from reached entries during active run", async () => {
    const controller = new RunController("RunTest_progress_5", "RunController");
    await controller.isHydrated;

    // Simulate run start
    controller.setStatus(STATUS.RUNNING);

    // Pre-populate with 5 entries as inactive (simulating graphstart)
    for (let i = 0; i < 5; i++) {
      controller.setConsoleEntry(`node-${i}`, {
        completed: false,
        status: { status: "inactive" },
      } as unknown as ConsoleEntry);
    }

    // Mark 2 entries as reached (status moved beyond inactive)
    controller.setConsoleEntry("node-0", {
      completed: false,
      status: { status: "succeeded" },
    } as unknown as ConsoleEntry);
    controller.setConsoleEntry("node-1", {
      completed: false,
      status: { status: "working" },
    } as unknown as ConsoleEntry);
    await controller.isSettled;

    assert.strictEqual(controller.progress, 0.4); // 2/5
  });

  test("progress is 1 when run completed (stopped after running)", async () => {
    const controller = new RunController(
      "RunTest_progress_5b",
      "RunController"
    );
    await controller.isHydrated;

    // Simulate a full run lifecycle: start then stop
    controller.setStatus(STATUS.RUNNING);
    controller.setConsoleEntry("node-1", {
      completed: true,
      status: { status: "succeeded" },
    } as unknown as ConsoleEntry);
    controller.setStatus(STATUS.STOPPED);
    await controller.isSettled;

    assert.strictEqual(controller.progress, 1);
  });

  test("reset clears estimatedEntryCount", async () => {
    const controller = new RunController("RunTest_progress_6", "RunController");
    await controller.isHydrated;

    controller.setEstimatedEntryCount(10);
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.estimatedEntryCount, 0);
  });

  test("progress during PAUSED state counts reached entries", async () => {
    const controller = new RunController("RunTest_progress_7", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    controller.setConsoleEntry("node-0", {
      status: { status: "succeeded" },
    } as unknown as ConsoleEntry);
    controller.setConsoleEntry("node-1", {
      status: { status: "inactive" },
    } as unknown as ConsoleEntry);
    controller.setStatus(STATUS.PAUSED);
    await controller.isSettled;

    assert.strictEqual(controller.progress, 0.5); // 1/2
  });

  test("progress is 0 when RUNNING but console is empty", async () => {
    const controller = new RunController("RunTest_progress_8", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;

    assert.strictEqual(controller.progress, 0);
  });

  test("progress with entries missing status field treated as unreached", async () => {
    const controller = new RunController("RunTest_progress_9", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    controller.setConsoleEntry("node-0", {
      status: { status: "succeeded" },
    } as unknown as ConsoleEntry);
    controller.setConsoleEntry("node-1", {
      // no status field at all
    } as unknown as ConsoleEntry);
    await controller.isSettled;

    assert.strictEqual(controller.progress, 0.5); // 1/2
  });
});

suite("RunController nodeActionRequest", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("nodeActionRequest defaults to null", async () => {
    const controller = new RunController("RunTest_nar_1", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.nodeActionRequest, null);
  });

  test("setNodeActionRequest sets request", async () => {
    const controller = new RunController("RunTest_nar_2", "RunController");
    await controller.isHydrated;

    const request = { nodeId: "node-1", actionContext: "step" as const };
    controller.setNodeActionRequest(request);
    await controller.isSettled;

    assert.deepStrictEqual(controller.nodeActionRequest, request);
  });

  test("clearNodeActionRequest clears request", async () => {
    const controller = new RunController("RunTest_nar_3", "RunController");
    await controller.isHydrated;

    controller.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "step",
    });
    await controller.isSettled;

    controller.clearNodeActionRequest();
    await controller.isSettled;

    assert.strictEqual(controller.nodeActionRequest, null);
  });

  test("reset clears nodeActionRequest", async () => {
    const controller = new RunController("RunTest_nar_4", "RunController");
    await controller.isHydrated;

    controller.setNodeActionRequest({
      nodeId: "node-1",
      actionContext: "step",
    });
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.nodeActionRequest, null);
  });
});

suite("RunController replaceConsole", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("replaces entire console with new entries", async () => {
    const controller = new RunController("RunTest_replcon_1", "RunController");
    await controller.isHydrated;

    controller.setConsoleEntry("old", {
      title: "old",
    } as unknown as ConsoleEntry);
    await controller.isSettled;
    assert.strictEqual(controller.console.size, 1);

    const newEntries = new Map<string, ConsoleEntry>([
      ["a", { title: "A" } as unknown as ConsoleEntry],
      ["b", { title: "B" } as unknown as ConsoleEntry],
    ]);
    controller.replaceConsole(newEntries);
    await controller.isSettled;

    assert.strictEqual(controller.console.size, 2);
    assert.ok(controller.console.has("a"));
    assert.ok(controller.console.has("b"));
    assert.ok(!controller.console.has("old"));
  });
});

suite("RunController undismissError", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("removes a node from dismissedErrors set", async () => {
    const controller = new RunController("RunTest_undis_1", "RunController");
    await controller.isHydrated;

    controller.setError({ message: "err" });
    controller.dismissError("node-1");
    await controller.isSettled;

    assert.ok(controller.dismissedErrors.has("node-1"));

    controller.undismissError("node-1");
    await controller.isSettled;

    assert.ok(!controller.dismissedErrors.has("node-1"));
  });
});

suite("RunController setRunner", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("sets runner and abortController", async () => {
    const controller = new RunController("RunTest_setrun_1", "RunController");
    await controller.isHydrated;

    const mockRunner = { run: () => {} } as unknown as HarnessRunner;
    const mockAbort = new AbortController();
    controller.setRunner(mockRunner, mockAbort);

    assert.strictEqual(controller.runner, mockRunner);
    assert.strictEqual(controller.abortController, mockAbort);
  });
});

/**
 * Tests for RunController.createConsoleEntry static factory.
 */
suite("RunController.createConsoleEntry", () => {
  test("creates entry with required fields", () => {
    const entry = RunController.createConsoleEntry("Test Step", "inactive");

    assert.strictEqual(entry.title, "Test Step");
    assert.deepStrictEqual(entry.status, { status: "inactive" });
    assert.strictEqual(entry.open, false);
    assert.strictEqual(entry.rerun, false);
    assert.strictEqual(entry.error, null);
    assert.strictEqual(entry.current, null);
    assert.ok(entry.work instanceof Map);
    assert.ok(entry.output instanceof Map);
  });

  test("creates entry with icon and tags options", () => {
    const entry = RunController.createConsoleEntry("Test Step", "working", {
      icon: "step-icon",
      tags: ["input", "user"],
    });

    assert.strictEqual(entry.icon, "step-icon");
    assert.deepStrictEqual(entry.tags, ["input", "user"]);
  });

  test("sets completed to true for succeeded status", () => {
    const entry = RunController.createConsoleEntry("Test Step", "succeeded");

    assert.strictEqual(entry.completed, true);
  });

  test("sets completed to false for non-succeeded status", () => {
    const inactiveEntry = RunController.createConsoleEntry("Test", "inactive");
    const workingEntry = RunController.createConsoleEntry("Test", "working");
    const skippedEntry = RunController.createConsoleEntry("Test", "skipped");

    assert.strictEqual(inactiveEntry.completed, false);
    assert.strictEqual(workingEntry.completed, false);
    assert.strictEqual(skippedEntry.completed, false);
  });

  test("handles undefined options gracefully", () => {
    const entry = RunController.createConsoleEntry("Test Step", "ready");

    assert.strictEqual(entry.icon, undefined);
    assert.strictEqual(entry.tags, undefined);
  });
});

// =============================================================================
// clearRunner
// =============================================================================

suite("RunController.clearRunner", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("clears runner, abortController, and onInputRequested", async () => {
    const controller = new RunController("RunTest_clear_1", "RunController");
    await controller.isHydrated;

    const mockRunner = {} as unknown as HarnessRunner;
    const mockAbort = new AbortController();
    controller.setRunner(mockRunner, mockAbort);
    controller.onInputRequested = () => {};

    assert.strictEqual(controller.runner, mockRunner);
    assert.strictEqual(controller.abortController, mockAbort);
    assert.ok(controller.onInputRequested);

    controller.clearRunner();

    assert.strictEqual(controller.runner, null);
    assert.strictEqual(controller.abortController, null);
    assert.strictEqual(controller.onInputRequested, null);
  });

  test("is distinct from reset (does not clear console or input)", async () => {
    const controller = new RunController("RunTest_clear_2", "RunController");
    await controller.isHydrated;

    // Populate output state
    const mockEntry = { id: "node-1" } as unknown as ConsoleEntry;
    controller.setConsoleEntry("node-1", mockEntry);
    controller.setInput({ id: "node-1", schema: {} });
    await controller.isSettled;

    // Populate runner state
    const mockRunner = {} as unknown as HarnessRunner;
    controller.setRunner(mockRunner, new AbortController());

    controller.clearRunner();

    // Runner state cleared
    assert.strictEqual(controller.runner, null);
    // Output state preserved
    assert.strictEqual(controller.console.size, 1);
    assert.ok(controller.input);
  });
});

// =============================================================================
// inputs getter and pendingInputNodeIds
// =============================================================================

suite("RunController.inputs and pendingInputNodeIds", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("addPendingInput populates pendingInputNodeIds and inputSchemas", async () => {
    const controller = new RunController("RunTest_inputs_3", "RunController");
    await controller.isHydrated;

    const schema = { properties: { text: { type: "string" } } } as Schema;
    controller.addPendingInput("input-1", schema);

    assert.strictEqual(controller.pendingInputNodeIds.size, 1);
    assert.ok(controller.pendingInputNodeIds.has("input-1"));
    assert.deepStrictEqual(controller.inputSchemas.get("input-1"), schema);
  });

  test("removePendingInput clears node from queue", async () => {
    const controller = new RunController("RunTest_inputs_4", "RunController");
    await controller.isHydrated;

    controller.addPendingInput("node-a", { properties: {} } as Schema);
    assert.strictEqual(controller.pendingInputNodeIds.size, 1);

    controller.removePendingInput("node-a");
    assert.strictEqual(controller.pendingInputNodeIds.size, 0);
    assert.strictEqual(controller.inputSchemas.size, 0);
  });

  test("nextPendingInputId returns the first queued node", async () => {
    const controller = new RunController("RunTest_inputs_5", "RunController");
    await controller.isHydrated;

    controller.addPendingInput("first", { properties: {} } as Schema);
    controller.addPendingInput("second", { properties: {} } as Schema);

    assert.strictEqual(controller.nextPendingInputId, "first");
  });

  test("nextPendingInputId returns undefined when empty", async () => {
    const controller = new RunController("RunTest_inputs_6", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.nextPendingInputId, undefined);
  });

  test("inputSchemas returns stored schemas", async () => {
    const controller = new RunController("RunTest_inputs_7", "RunController");
    await controller.isHydrated;

    const schema = { properties: { q: { type: "string" } } } as Schema;
    controller.addPendingInput("s-node", schema);

    assert.strictEqual(controller.inputSchemas.size, 1);
    assert.deepStrictEqual(controller.inputSchemas.get("s-node"), schema);
  });
});

// =============================================================================
// requestInputForNode, activateInputForNode, resolveInputForNode
// =============================================================================

suite("RunController input lifecycle", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("requestInputForNode stores resolver and schema, calls onInputRequested", async () => {
    const controller = new RunController("RunTest_reqInput_1", "RunController");
    await controller.isHydrated;

    let requestedId: string | null = null;
    let requestedSchema: Schema | null = null;
    controller.onInputRequested = (id, schema) => {
      requestedId = id;
      requestedSchema = schema;
    };

    const schema = { properties: { name: { type: "string" } } } as Schema;
    // Start the request without awaiting (it blocks until resolved)
    const promise = controller.requestInputForNode("node-x", schema);

    assert.strictEqual(requestedId, "node-x");
    assert.deepStrictEqual(requestedSchema, schema);

    // Resolve it
    controller.resolveInputForNode("node-x", { name: "Alice" });
    const result = await promise;
    assert.deepStrictEqual(result, { name: "Alice" });
  });

  test("activateInputForNode creates a WorkItem on the console entry", async () => {
    const controller = new RunController("RunTest_actInput_1", "RunController");
    await controller.isHydrated;

    const schema = { properties: { q: { type: "string" } } } as Schema;
    const entry = RunController.createConsoleEntry("Input", "working", {
      id: "node-y",
      controller,
    });
    controller.setConsoleEntry("node-y", entry);
    await controller.isSettled;

    // Request input first (stores the schema)
    controller.requestInputForNode("node-y", schema);

    // Now activate
    controller.activateInputForNode("node-y");

    const storedEntry = controller.console.get("node-y");
    assert.ok(storedEntry, "Entry should exist");
    assert.ok(storedEntry!.work.size > 0, "Should have a work item");
    assert.ok(storedEntry!.current, "Should have a current work item");
    assert.strictEqual(storedEntry!.current!.awaitingUserInput, true);
    assert.strictEqual(storedEntry!.current!.title, "Input");
  });

  test("activateInputForNode does nothing when no schema", async () => {
    const controller = new RunController("RunTest_actInput_2", "RunController");
    await controller.isHydrated;

    const entry = RunController.createConsoleEntry("Step", "working");
    controller.setConsoleEntry("node-z", entry);
    await controller.isSettled;

    // No requestInputForNode call, so no schema stored
    controller.activateInputForNode("node-z");

    const storedEntry = controller.console.get("node-z");
    assert.strictEqual(storedEntry!.work.size, 0);
  });

  test("activateInputForNode does nothing when no console entry", async () => {
    const controller = new RunController("RunTest_actInput_3", "RunController");
    await controller.isHydrated;

    // Store schema but no console entry
    controller.requestInputForNode("missing-node", {
      properties: {},
    } as Schema);

    // Should not throw
    controller.activateInputForNode("missing-node");
  });

  test("resolveInputForNode resolves the pending promise and cleans up", async () => {
    const controller = new RunController("RunTest_resolve_1", "RunController");
    await controller.isHydrated;

    const schema = { properties: {} } as Schema;
    const promise = controller.requestInputForNode("r-node", schema);

    controller.resolveInputForNode("r-node", { answer: 42 });
    const result = await promise;

    assert.deepStrictEqual(result, { answer: 42 });
  });

  test("resolveInputForNode is safe when no pending resolver", async () => {
    const controller = new RunController("RunTest_resolve_2", "RunController");
    await controller.isHydrated;

    // Should not throw
    controller.resolveInputForNode("nonexistent", { data: true });
  });
});

// =============================================================================
// createConsoleEntry delegate methods
// =============================================================================

suite("RunController.createConsoleEntry delegates", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("requestInput delegates to controller.requestInputForNode", async () => {
    const controller = new RunController("RunTest_delegate_1", "RunController");
    await controller.isHydrated;

    const schema = { properties: { text: { type: "string" } } } as Schema;
    const entry = RunController.createConsoleEntry("Delegate Test", "working", {
      id: "del-node",
      controller,
    });

    // Start input request via the entry's delegate
    const promise = entry.requestInput(schema);

    // Resolve via the controller
    controller.resolveInputForNode("del-node", { text: "hello" });

    const result = await promise;
    assert.deepStrictEqual(result, { text: "hello" });
  });

  test("requestInput rejects when no controller bound", async () => {
    const entry = RunController.createConsoleEntry("No Ctrl", "working");

    await assert.rejects(
      () => entry.requestInput({ properties: {} } as Schema),
      { message: "No controller bound for input" }
    );
  });

  test("activateInput delegates to controller.activateInputForNode", async () => {
    const controller = new RunController("RunTest_delegate_2", "RunController");
    await controller.isHydrated;

    const schema = { properties: {} } as Schema;
    const entry = RunController.createConsoleEntry("Activate Test", "working", {
      id: "act-node",
      controller,
    });
    controller.setConsoleEntry("act-node", entry);
    await controller.isSettled;

    // Store schema first
    controller.requestInputForNode("act-node", schema);

    // Activate via delegate
    entry.activateInput();

    const stored = controller.console.get("act-node");
    assert.ok(stored!.work.size > 0, "Should have work item from activation");
  });

  test("activateInput is no-op when no controller bound", () => {
    const entry = RunController.createConsoleEntry("No Ctrl", "working");

    // Should not throw
    entry.activateInput();
  });

  test("resolveInput delegates to controller.resolveInputForNode", async () => {
    const controller = new RunController("RunTest_delegate_3", "RunController");
    await controller.isHydrated;

    const schema = { properties: {} } as Schema;
    const entry = RunController.createConsoleEntry("Resolve Test", "working", {
      id: "res-node",
      controller,
    });

    const promise = entry.requestInput(schema);
    entry.resolveInput({ value: "done" });

    const result = await promise;
    assert.deepStrictEqual(result, { value: "done" });
  });

  test("resolveInput is no-op when no controller bound", () => {
    const entry = RunController.createConsoleEntry("No Ctrl", "working");

    // Should not throw
    entry.resolveInput({ value: "ignored" });
  });
});
