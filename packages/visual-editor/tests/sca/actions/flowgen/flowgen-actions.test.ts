/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, mock, test } from "node:test";
import * as FlowgenActions from "../../../../src/sca/actions/flowgen/flowgen-actions.js";
import type { FlowGenerator } from "../../../../src/ui/flow-gen/flow-generator.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import * as GraphActions from "../../../../src/sca/actions/graph/graph-actions.js";
import {
  makeTestFixtures,
  makeFreshGraph as makeTestGraph,
  makeTestProjectState,
} from "../../helpers/index.js";

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

  FlowgenActions.bind({ controller, services });
  GraphActions.bind({ controller, services });

  return { controller, services, mocks };
}

suite("Flowgen Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  // Note: Tests for blockingAction, status="generating", stop(), and analytics
  // are NOT included here because those behaviors are handled by the event router
  // (src/event-routing/flowgen/flowgen.ts), not this action. This action tests
  // only the core generation logic.

  test("generate returns success on successful generation", async () => {
    setupFlowgenTest({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    const result = await FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

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
    const { mocks } = setupFlowgenTest({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });
    mocks.flowgenInput.inputValue = "some input";

    await FlowgenActions.generate("test intent", makeTestProjectState());

    assert.strictEqual(
      mocks.flowgenInput.inputValue,
      "",
      "input should be cleared"
    );
    assert.deepStrictEqual(
      mocks.flowgenInput.state,
      { status: "initial" },
      "state should be initial"
    );
  });

  test("generate returns error when no active graph", async () => {
    // Create fixtures WITHOUT an editor to test the no-graph case
    const { controller, services } = makeTestFixtures({
      withEditor: false,
    });

    FlowgenActions.bind({ controller, services });

    const result = await FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

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

    const result = await FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

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

  test("generate catch block handles unexpected synchronous errors", async () => {
    // We want to force a throw in the try block *outside* of flowGenWithTheme
    // since flowGenWithTheme catches its own promise rejections
    const testError = new Error("Simulated runtime error");
    const { mocks } = setupFlowgenTest({
      oneShot: mock.fn(() => Promise.resolve({ flow: makeTestGraph() })),
    });

    // Make clear() throw an error to hit the outer catch block
    mocks.flowgenInput.clear = () => {
      throw testError;
    };

    const result = await FlowgenActions.generate(
      "test intent",
      makeTestProjectState()
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(
      (result as { success: false; error: unknown }).error,
      testError
    );

    // Check that error state was set from the catch block
    assert.deepStrictEqual(mocks.flowgenInput.state, {
      status: "error",
      error: testError,
    });
  });
});
