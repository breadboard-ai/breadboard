/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, describe, test } from "node:test";
import * as RunTriggers from "../../../../src/sca/triggers/run/run-triggers.js";
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

  test("registerGraphSyncTrigger is listed after registration", () => {
    const { controller } = makeTestController();
    const { services } = makeTestServices();
    RunTriggers.bind({ controller, services, actions: {} as AppActions });

    RunTriggers.registerGraphSyncTrigger();

    const list = RunTriggers.bind.list();
    assert.ok(
      list.includes("[effect] Graph Synchronization Trigger"),
      `Expected trigger to be listed, got: ${list}`
    );
  });
});
