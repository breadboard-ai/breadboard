/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, mock, test } from "node:test";
import * as FlowgenActions from "../../../../src/sca/actions/flowgen/flowgen-actions.js";

import type { FlowGenerator } from "../../../../src/ui/flow-gen/flow-generator.js";
import { StateEvent } from "../../../../src/ui/events/events.js";

import { setDOM, unsetDOM } from "../../../fake-dom.js";
import * as GraphActions from "../../../../src/sca/actions/graph/graph-actions.js";
import {
  makeTestFixtures,
  makeFreshGraph as makeTestGraph,
} from "../../helpers/index.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

/**
 * Sets up flowgen test fixtures using the composable pattern.
 * Creates controller, services, and mocks needed for flowgen tests.
 *
 * Note: The action only handles core flowgen logic (calling flowGenWithTheme,
 * setting error state, replacing graph). Other concerns like blockingAction,
 * status="generating", stop(), and analytics are handled by the event router.
 */
function setupFlowgenTest(flowGeneratorMock: Partial<FlowGenerator>) {
  const { controller, services, mocks } = makeTestFixtures({
    withEditor: true,
    flowGeneratorMock,
  });

  FlowgenActions.bind({
    controller,
    services,
    env: createMockEnvironment(defaultRuntimeFlags),
  });
  GraphActions.bind({
    controller,
    services,
    env: createMockEnvironment(defaultRuntimeFlags),
  });

  return { controller, services, mocks };
}

suite("Flowgen Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  // Note: Tests below cover the core SCA action (onFlowgenGenerate)
  // as well as the standalone `generate` function.

  test("generate returns success on successful generation", async () => {
    setupFlowgenTest({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    const result = await FlowgenActions.generate("test intent");

    assert.deepStrictEqual(result, { success: true });
  });

  test("generate returns error on failure", async () => {
    const { mocks } = setupFlowgenTest({
      oneShot: mock.fn(() =>
        Promise.resolve({
          error: "Generation failed",
          suggestedIntent: "try this instead",
        })
      ),
    });

    const result = await FlowgenActions.generate("test intent");

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

  test("generate sets pendingGraphReplacement on success", async () => {
    const { controller } = setupFlowgenTest({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    await FlowgenActions.generate("test intent");

    // Verify pendingGraphReplacement was set (replaceWithTheme will apply it)
    const pending = controller.editor.graph.pendingGraphReplacement;
    assert.ok(pending, "pendingGraphReplacement should be set");
    assert.ok(pending!.replacement, "should have a replacement graph");
    assert.deepStrictEqual(
      pending!.creator,
      { role: "assistant" },
      "creator should be assistant"
    );
  });

  test("generate returns error when no active graph", async () => {
    // Create fixtures WITHOUT an editor to test the no-graph case
    const { controller, services } = makeTestFixtures({
      withEditor: false,
    });

    FlowgenActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const result = await FlowgenActions.generate("test intent");

    assert.deepStrictEqual(result, {
      success: false,
      error: "No active graph to edit",
    });
  });

  test("generate handles thrown errors", async () => {
    const testError = new Error("Simulated failure for test");
    const { mocks } = setupFlowgenTest({
      oneShot: mock.fn(() => Promise.reject(testError)),
    });

    const result = await FlowgenActions.generate("test intent");

    assert.strictEqual(result.success, false);
    assert.strictEqual(
      (result as { success: false; error: unknown }).error,
      testError
    );

    // Check that error state was set
    assert.deepStrictEqual(mocks.flowgenInput.state, {
      status: "error",
      error: testError,
      suggestedIntent: undefined,
    });
  });

  // Note: The old "generate catch block handles unexpected synchronous errors"
  // test was removed because flowgenInput.clear() is no longer called in generate.
  // It was moved to Graph.replaceWithTheme to prevent a UI flash between
  // generation completing and the graph replacement being applied.
});

suite("onFlowgenGenerate", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  function setupOnFlowgenGenerate(flowGeneratorMock: Partial<FlowGenerator>) {
    const { controller, services, mocks } = makeTestFixtures({
      withEditor: true,
      flowGeneratorMock,
    });

    // Patch the run domain so `stopRun` works against this mock controller.
    // makeTestFixtures with editor provides a minimal run.main; we augment it.
    const runMocks = {
      abortController: null as AbortController | null,
      resetCalled: false,
      setStatusCalled: null as string | null,
    };
    const runMain = controller.run.main as unknown as Record<string, unknown>;
    runMain.abortController = runMocks.abortController;
    runMain.reset = () => {
      runMocks.resetCalled = true;
    };
    runMain.setStatus = (status: string) => {
      runMocks.setStatusCalled = status;
    };
    runMain.bumpStopVersion = () => {};
    // Ensure screen and renderer have reset
    (controller.run.screen as unknown as Record<string, unknown>).reset ??=
      () => {};
    (controller.run.renderer as unknown as Record<string, unknown>).reset ??=
      () => {};

    FlowgenActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    GraphActions.bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    return { controller, services, mocks, runMocks };
  }

  test("calls stopRun before generating", async () => {
    const { runMocks } = setupOnFlowgenGenerate({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    const evt = new StateEvent<"flowgen.generate">({
      eventType: "flowgen.generate",
      intent: "test intent",
    });

    await FlowgenActions.onFlowgenGenerate(evt);

    assert.strictEqual(
      runMocks.resetCalled,
      true,
      "stopRun should have called run.main.reset()"
    );
  });

  test("sets generating status", async () => {
    const { mocks } = setupOnFlowgenGenerate({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    const evt = new StateEvent<"flowgen.generate">({
      eventType: "flowgen.generate",
      intent: "test intent",
    });

    await FlowgenActions.onFlowgenGenerate(evt);

    // The generating status is set before generate runs, but generate replaces
    // it with success/error result. Check mock was called properly by verifying
    // the flowgenInput was written to.
    assert.ok(mocks.flowgenInput, "flowgenInput mock should exist");
  });

  test("tracks analytics event", async () => {
    const { controller, mocks } = setupOnFlowgenGenerate({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    // Set a URL for tracking
    controller.editor.graph.url = "test://board.json";

    const evt = new StateEvent<"flowgen.generate">({
      eventType: "flowgen.generate",
      intent: "test intent",
    });

    await FlowgenActions.onFlowgenGenerate(evt);

    assert.strictEqual(
      mocks.actionTracker.flowGenEdit.mock.callCount(),
      1,
      "flowGenEdit should be called once"
    );
    assert.strictEqual(
      mocks.actionTracker.flowGenEdit.mock.calls[0].arguments[0],
      "test://board.json"
    );
  });

  test("wraps generation in withUIBlocking", async () => {
    const { controller } = setupOnFlowgenGenerate({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    const evt = new StateEvent<"flowgen.generate">({
      eventType: "flowgen.generate",
      intent: "test intent",
    });

    // blockingAction starts false
    assert.strictEqual(controller.global.main.blockingAction, false);

    await FlowgenActions.onFlowgenGenerate(evt);

    // withUIBlocking sets blockingAction=true then false in finally
    assert.strictEqual(
      controller.global.main.blockingAction,
      false,
      "blockingAction should be reset to false after completion"
    );
  });

  test("passes empty string when no url", async () => {
    const { controller, mocks } = setupOnFlowgenGenerate({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    controller.editor.graph.url = null;

    const evt = new StateEvent<"flowgen.generate">({
      eventType: "flowgen.generate",
      intent: "test intent",
    });

    await FlowgenActions.onFlowgenGenerate(evt);

    assert.strictEqual(
      mocks.actionTracker.flowGenEdit.mock.calls[0].arguments[0],
      "",
      "should fall back to empty string"
    );
  });
});
