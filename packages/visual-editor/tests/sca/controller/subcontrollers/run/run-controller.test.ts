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

  test("reset returns status to STOPPED", async () => {
    const controller = new RunController("RunTest_3", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.status, STATUS.STOPPED);
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

    // Reset - stopped again
    controller.reset();
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

suite("RunController start/stop methods", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("start throws if no runner", async () => {
    const controller = new RunController("RunTest_8", "RunController");
    await controller.isHydrated;

    assert.throws(
      () => controller.start(),
      /start\(\) called without an active runner/
    );
  });

  test("stop aborts abortController if present", async () => {
    const controller = new RunController("RunTest_9", "RunController");
    await controller.isHydrated;

    const abortController = new AbortController();
    const mockRunner = new EventTarget() as unknown as Parameters<typeof controller.setRunner>[0];
    controller.setRunner(mockRunner, abortController);

    assert.strictEqual(abortController.signal.aborted, false);

    controller.stop();
    await controller.isSettled;

    assert.strictEqual(abortController.signal.aborted, true);
    assert.strictEqual(controller.status, STATUS.STOPPED);
  });

  test("stop sets status to STOPPED even without abortController", async () => {
    const controller = new RunController("RunTest_10", "RunController");
    await controller.isHydrated;

    controller.setStatus(STATUS.RUNNING);
    await controller.isSettled;

    controller.stop();
    await controller.isSettled;

    assert.strictEqual(controller.status, STATUS.STOPPED);
  });

  test("start calls runner.start()", async () => {
    const controller = new RunController("RunTest_11", "RunController");
    await controller.isHydrated;

    let startCalled = false;
    const mockRunner = {
      start: () => {
        startCalled = true;
      },
    } as unknown as Parameters<typeof controller.setRunner>[0];
    const abortController = new AbortController();
    controller.setRunner(mockRunner, abortController);

    controller.start();

    assert.strictEqual(startCalled, true, "runner.start() should be called");
  });
});
