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
});
