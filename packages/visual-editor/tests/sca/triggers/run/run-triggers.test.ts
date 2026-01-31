/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, describe, test } from "node:test";
import * as RunTriggers from "../../../../src/sca/triggers/run/run-triggers.js";
import { STATUS } from "../../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { makeTestController, makeTestServices } from "../utils.js";
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
});
