/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import {
  registerGraphInvalidateTrigger,
  registerGraphUrlChangeTrigger,
  bind,
} from "../../../../src/sca/triggers/agent/agent-triggers.js";
import { appController } from "../../../../src/sca/controller/controller.js";
import { AppActions } from "../../../../src/sca/actions/actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { createMockEditor, flushEffects } from "../utils.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

suite("Agent Triggers", () => {
  // Get the singleton controller once for all tests
  let controller: ReturnType<typeof appController>;

  before(async () => {
    setDOM();
    controller = appController(defaultRuntimeFlags);
    await controller.isHydrated;
  });

  after(() => {
    unsetDOM();
  });

  afterEach(() => {
    // Clean up any registered triggers between tests.
    bind.clean();

    // Reset the graph controller state between tests.
    controller.editor.graph.setEditor(null);
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = 0;
  });

  test("Graph invalidate trigger fires when version changes on a writable graph", async () => {
    // Track whether invalidateResumableRuns was called
    let invalidateCalled = false;
    const services = {
      agentContext: {
        invalidateResumableRuns() {
          invalidateCalled = true;
        },
      },
    } as AppServices;

    const actions = {} as AppActions;

    // Bind the trigger dependencies.
    bind({ controller, services, actions });

    // Set up the graph controller with a mock editor.
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = 0;

    // Register the trigger - this creates the effect.
    registerGraphInvalidateTrigger();

    // Reset the flag after initial effect run.
    await flushEffects();
    invalidateCalled = false;

    // Trigger a version change by incrementing the version.
    controller.editor.graph.version = 1;

    // Wait for the microtask effect to run.
    await flushEffects();

    assert.strictEqual(
      invalidateCalled,
      true,
      "invalidateResumableRuns() should have been called"
    );
  });

  test("Graph invalidate trigger does not fire when graph is readOnly", async () => {
    let invalidateCalled = false;
    const services = {
      agentContext: {
        invalidateResumableRuns() {
          invalidateCalled = true;
        },
      },
    } as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });

    // Set up the graph controller with a mock editor but readOnly.
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = true;
    controller.editor.graph.version = 0;

    // Register the trigger and flush initial effect.
    registerGraphInvalidateTrigger();
    await flushEffects();
    invalidateCalled = false;

    // Trigger a version change.
    controller.editor.graph.version = 2;
    await flushEffects();

    assert.strictEqual(
      invalidateCalled,
      false,
      "invalidateResumableRuns() should not have been called for readOnly graph"
    );
  });

  test("Graph invalidate trigger does not fire when version is -1", async () => {
    let invalidateCalled = false;
    const services = {
      agentContext: {
        invalidateResumableRuns() {
          invalidateCalled = true;
        },
      },
    } as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });

    // Set up the graph controller with version -1 (uninitialized).
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = -1;

    registerGraphInvalidateTrigger();
    await flushEffects();

    assert.strictEqual(
      invalidateCalled,
      false,
      "invalidateResumableRuns() should not have been called when version is -1"
    );
  });

  test("Graph URL change trigger clears runs when URL changes", async () => {
    let clearAllRunsCalled = false;
    const services = {
      agentContext: {
        clearAllRuns() {
          clearAllRunsCalled = true;
        },
      },
    } as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });

    // Set up initial URL.
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.url = "http://example.com/graph1";

    // Register the trigger.
    registerGraphUrlChangeTrigger();
    await flushEffects();

    // First registration should not clear runs (initial load).
    assert.strictEqual(
      clearAllRunsCalled,
      false,
      "clearAllRuns() should not be called on initial load"
    );

    // Change to a different URL.
    controller.editor.graph.url = "http://example.com/graph2";
    await flushEffects();

    assert.strictEqual(
      clearAllRunsCalled,
      true,
      "clearAllRuns() should be called when graph URL changes"
    );
  });

  test("Graph URL change trigger does not clear runs when URL is unchanged", async () => {
    let clearAllRunsCallCount = 0;
    const services = {
      agentContext: {
        clearAllRuns() {
          clearAllRunsCallCount++;
        },
      },
    } as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });

    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.url = "http://example.com/graph1";

    registerGraphUrlChangeTrigger();
    await flushEffects();

    // Set the same URL again.
    controller.editor.graph.url = "http://example.com/graph1";
    await flushEffects();

    assert.strictEqual(
      clearAllRunsCallCount,
      0,
      "clearAllRuns() should not be called when URL is unchanged"
    );
  });

  test("Graph URL change trigger does not clear runs on first URL set", async () => {
    let clearAllRunsCalled = false;
    const services = {
      agentContext: {
        clearAllRuns() {
          clearAllRunsCalled = true;
        },
      },
    } as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });

    // Start with no URL set.
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.url = null;

    registerGraphUrlChangeTrigger();
    await flushEffects();

    // Set the first URL.
    controller.editor.graph.url = "http://example.com/graph1";
    await flushEffects();

    assert.strictEqual(
      clearAllRunsCalled,
      false,
      "clearAllRuns() should not be called on first URL set (initial load)"
    );
  });
});
