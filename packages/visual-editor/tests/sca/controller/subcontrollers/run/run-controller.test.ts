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
import type { ConsoleEntry, RunError } from "@breadboard-ai/types";

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

suite("RunController status helpers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("isRunning returns true only when RUNNING", async () => {
    const controller = new RunController("RunTest_4", "RunController");
    await controller.isHydrated;

    // Default: not running
    assert.strictEqual(controller.isRunning, false);

    // Set to RUNNING
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.isRunning, true);

    // Set to PAUSED - not running
    controller.setStatus(STATUS.PAUSED);
    await controller.isSettled;
    assert.strictEqual(controller.isRunning, false);
  });

  test("isPaused returns true only when PAUSED", async () => {
    const controller = new RunController("RunTest_5", "RunController");
    await controller.isHydrated;

    // Default: not paused
    assert.strictEqual(controller.isPaused, false);

    // Set to PAUSED
    controller.setStatus(STATUS.PAUSED);
    await controller.isSettled;
    assert.strictEqual(controller.isPaused, true);

    // Set to RUNNING - not paused
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.isPaused, false);
  });

  test("isStopped returns true only when STOPPED", async () => {
    const controller = new RunController("RunTest_6", "RunController");
    await controller.isHydrated;

    // Default: stopped
    assert.strictEqual(controller.isStopped, true);

    // Set to RUNNING - not stopped
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.isStopped, false);

    // Set back to STOPPED
    controller.setStatus(STATUS.STOPPED);
    await controller.isSettled;
    assert.strictEqual(controller.isStopped, true);
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
    assert.strictEqual(controller.isStopped, true);

    // User starts run
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.isRunning, true);

    // Run pauses for input
    controller.setStatus(STATUS.PAUSED);
    await controller.isSettled;
    assert.strictEqual(controller.isPaused, true);
    assert.strictEqual(controller.isRunning, false);

    // User provides input, run resumes
    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;
    assert.strictEqual(controller.isRunning, true);

    // Run completes
    controller.setStatus(STATUS.STOPPED);
    await controller.isSettled;
    assert.strictEqual(controller.isStopped, true);
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
    assert.strictEqual(controller.console.get("node-1"), mockEntry);
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

  test("progress is 0 when estimatedEntryCount is 0", async () => {
    const controller = new RunController("RunTest_progress_4", "RunController");
    await controller.isHydrated;

    assert.strictEqual(controller.progress, 0);
  });

  test("progress computed from console size / estimatedEntryCount", async () => {
    const controller = new RunController("RunTest_progress_5", "RunController");
    await controller.isHydrated;

    controller.setEstimatedEntryCount(10);
    controller.setConsoleEntry("node-1", {
      id: "node-1",
    } as unknown as ConsoleEntry);
    controller.setConsoleEntry("node-2", {
      id: "node-2",
    } as unknown as ConsoleEntry);
    await controller.isSettled;

    assert.strictEqual(controller.progress, 0.2); // 2/10
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
