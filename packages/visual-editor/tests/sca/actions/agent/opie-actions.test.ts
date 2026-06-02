/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, afterEach, beforeEach, mock } from "node:test";
import * as OpieActions from "../../../../src/sca/actions/agent/opie-actions.js";
import * as GEAActions from "../../../../src/sca/actions/agent/graph-editing-agent-actions.js";
import * as GraphActions from "../../../../src/sca/actions/graph/graph-actions.js";
import { coordination } from "../../../../src/sca/coordination.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { makeTestServices, makeTestController } from "../../helpers/index.js";
import type { GoogleDriveBoardServer } from "../../../../src/board-server/server.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";

function makeMockRun() {
  const events = {
    handle: async () => ({}),
    on() {
      return events;
    },
  };
  return {
    runId: "test-run",
    events,
    sink: {
      emit: () => {},
      suspend: async (payload: unknown) => {
        if (payload && typeof payload === "object" && "readGraph" in payload) {
          return { graph: { edges: [], nodes: [] } };
        }
        return {};
      },
    },
  };
}

suite("opie-actions", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("createNew fails early if user rejects sign-in", async () => {
    const services = makeTestServices().services;
    services.askUserToSignInIfNeeded = async () => "failure";

    OpieActions.bind({
      controller: makeTestController().controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const result = await OpieActions.createNew();
    assert.deepStrictEqual(result, { success: false, reason: "auth-required" });
  });

  test("createNew fails if no board server is available", async () => {
    const services = makeTestServices().services;
    const testServices = services as {
      googleDriveBoardServer: unknown;
    } & AppServices;
    testServices.googleDriveBoardServer = null as never;

    OpieActions.bind({
      controller: makeTestController().controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const result = await OpieActions.createNew();
    assert.deepStrictEqual(result, {
      success: false,
      reason: "no-board-server",
    });
  });

  test("createNew successfully creates blank board, navigates, and waits for load", async () => {
    const controller: AppController = makeTestController().controller;
    const services = makeTestServices({
      googleDriveBoardServer: {
        create: async (_url: URL, _graph: unknown) => {
          return {
            url: "https://drive.google.com/file/d/test-id",
            result: true,
          };
        },
      } as unknown as GoogleDriveBoardServer,
    }).services;

    let navigateCalled = false;
    mock.method(controller.router, "go", () => {
      navigateCalled = true;
    });

    OpieActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Simulate loadState transition to "Loaded" after navigateToNewBoard is called.
    setTimeout(() => {
      controller.global.main.loadState = "Loaded";
    }, 10);

    const result = await OpieActions.createNew();

    assert.deepStrictEqual(result, {
      success: true,
      url: new URL("https://drive.google.com/file/d/test-id"),
    });
    assert.strictEqual(navigateCalled, true, "Should navigate to new board");
  });

  test("createNew starts Opie agent if intent is provided", async () => {
    const controller: AppController = makeTestController().controller;
    const services = makeTestServices({
      googleDriveBoardServer: {
        create: async (_url: URL, _graph: unknown) => {
          return {
            url: "https://drive.google.com/file/d/test-id",
            result: true,
          };
        },
      } as unknown as GoogleDriveBoardServer,
    }).services;

    // Bind OpieActions, GEAActions, and GraphActions to the same mock controller and services
    const env = createMockEnvironment(defaultRuntimeFlags);
    OpieActions.bind({ controller, services, env });
    GEAActions.bind({ controller, services, env });
    GraphActions.bind({ controller, services, env });

    let startRunCalled = false;
    mock.method(services.agentService, "startRun", () => {
      startRunCalled = true;
      return makeMockRun();
    });

    setTimeout(() => {
      controller.global.main.loadState = "Loaded";
    }, 10);

    const result = await OpieActions.createNew("Create a cool generator");

    assert.deepStrictEqual(result, {
      success: true,
      url: new URL("https://drive.google.com/file/d/test-id"),
    });

    const agent = controller.editor.graphEditingAgent;
    assert.strictEqual(agent.open, true, "Agent should be opened");
    assert.deepStrictEqual(agent.entries, [
      { role: "user", text: "Create a cool generator" },
    ]);
    assert.strictEqual(
      startRunCalled,
      true,
      "Should start the Opie agent run loop"
    );
  });
});
