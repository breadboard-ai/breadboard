/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import * as FlowgenActions from "../../../../src/sca/actions/flowgen/flowgen-actions.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import type { FlowGenerator } from "../../../../src/ui/flow-gen/flow-generator.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import type { Project } from "../../../../src/ui/state/types.js";
import { makeTestGraphStore } from "../../../helpers/_graph-store.js";
import { testKit } from "../../../test-kit.js";
import * as GraphActions from "../../../../src/sca/actions/graph/graph-actions.js";

/**
 * Creates a mock FlowgenInputController for testing.
 */
function makeMockFlowgenInput() {
  return {
    inputValue: "",
    state: { status: "initial" } as { status: string; error?: unknown; suggestedIntent?: string },
    setState(state: { status: string; error?: unknown; suggestedIntent?: string }) {
      this.state = state;
    },
    setInputValue(value: string) {
      this.inputValue = value;
    },
    clear() {
      this.inputValue = "";
      this.state = { status: "initial" };
    },
  };
}

/**
 * Helper to create a graph store with editor for testing.
 */
function makeTestGraphStoreWithEditor() {
  const graphStore = makeTestGraphStore({ kits: [testKit] });
  const testGraph: GraphDescriptor = { nodes: [], edges: [] };
  const mainGraphId = graphStore.addByDescriptor(testGraph);
  if (!mainGraphId.success) throw new Error("Unable to create graph");
  const editor = graphStore.edit(mainGraphId.result);
  if (!editor) throw new Error("Unable to edit graph");
  return { graphStore, editor };
}

/**
 * Creates a test controller with flowgen-specific mocks and real editor.
 */
function makeFlowgenTestController() {
  const { graphStore, editor } = makeTestGraphStoreWithEditor();
  const flowgenInput = makeMockFlowgenInput();
  const main = { blockingAction: false };
  const runStop = mock.fn();

  return {
    controller: {
      global: {
        flowgenInput,
        main,
      },
      run: {
        main: {
          stop: runStop,
        },
      },
      editor: {
        graph: {
          editor,
          lastNodeConfigChange: null,
        },
      },
    } as unknown as AppController,
    services: {
      graphStore,
    } as unknown as AppServices,
    mocks: {
      flowgenInput,
      main,
      runStop,
    },
  };
}

/**
 * Creates test services with a mock flow generator.
 */
function makeFlowgenTestServices(
  graphStore: AppServices["graphStore"],
  flowGeneratorMock: Partial<FlowGenerator>
) {
  const actionTrackerMock = {
    flowGenEdit: mock.fn(),
  };

  return {
    services: {
      flowGenerator: flowGeneratorMock as FlowGenerator,
      actionTracker: actionTrackerMock,
      graphStore,
    } as unknown as AppServices,
    mocks: {
      actionTracker: actionTrackerMock,
    },
  };
}

/**
 * Creates a minimal test graph.
 */
function makeTestGraph(): GraphDescriptor {
  return {
    nodes: [],
    edges: [],
    url: "test://board",
  };
}

/**
 * Creates a mock project state for testing.
 */
function makeTestProjectState(): Project {
  return {
    themes: {
      generateThemeFromIntent: mock.fn(() => Promise.resolve({ error: "skipped" })),
    },
  } as unknown as Project;
}

describe("Flowgen Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("generate sets blockingAction to true at start", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    const promise = FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

    // Check that it was set to true at start
    assert.strictEqual(mocks.main.blockingAction, true, "blockingAction should be true during generation");

    await promise;
  });

  test("generate sets blockingAction to false after completion", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(mocks.main.blockingAction, false, "blockingAction should be false after generation");
  });

  test("generate sets status to generating", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    let capturedStatus: string | undefined;
    const originalSetState = mocks.flowgenInput.setState.bind(mocks.flowgenInput);
    mocks.flowgenInput.setState = (state) => {
      if (!capturedStatus) capturedStatus = state.status;
      originalSetState(state);
    };

    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(capturedStatus, "generating", "status should be set to generating first");
  });

  test("generate calls stop on run controller", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(mocks.runStop.mock.callCount(), 1, "stop should be called once");
  });

  test("generate tracks analytics", async () => {
    const { controller, services: baseServices } = makeFlowgenTestController();
    const { services, mocks: serviceMocks } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(serviceMocks.actionTracker.flowGenEdit.mock.callCount(), 1);
  });

  test("generate returns success on successful generation", async () => {
    const { controller, services: baseServices } = makeFlowgenTestController();
    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    const result = await FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

    assert.deepStrictEqual(result, { success: true });
  });

  test("generate returns error on failure", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({
        error: "Generation failed",
        suggestedIntent: "try this instead",
      })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    const result = await FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

    assert.deepStrictEqual(result, {
      success: false,
      error: "Generation failed",
      suggestedIntent: "try this instead",
    });

    // Check that error state was set
    assert.deepStrictEqual(mocks.flowgenInput.state, {
      status: "error",
      error: "Generation failed",
      suggestedIntent: "try this instead",
    });
  });

  test("generate clears input on success", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    mocks.flowgenInput.inputValue = "some input";

    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(mocks.flowgenInput.inputValue, "", "input should be cleared");
    assert.deepStrictEqual(mocks.flowgenInput.state, { status: "initial" }, "state should be initial");
  });

  test("generate sets blockingAction to false even on error", async () => {
    const { controller, services: baseServices, mocks } = makeFlowgenTestController();
    const { services } = makeFlowgenTestServices(baseServices.graphStore, {
      oneShot: mock.fn(() => Promise.resolve({ error: "Failed" })),
    });

    FlowgenActions.bind({ controller, services });
    GraphActions.bind({ controller, services });

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(mocks.main.blockingAction, false, "blockingAction should be false even after error");
  });
});
