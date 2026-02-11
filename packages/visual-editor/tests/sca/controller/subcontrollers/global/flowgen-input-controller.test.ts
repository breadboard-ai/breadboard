/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { FlowgenInputController } from "../../../../../src/sca/controller/subcontrollers/global/flowgen-input-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import { SignalWatcher } from "../../../../signal-watcher.js";
import { Signal } from "signal-polyfill";

suite("FlowgenInputController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics - controller hydrates with initial values", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_1"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.hydrated, true);
    assert.strictEqual(controller.inputValue, "");
    assert.deepStrictEqual(controller.state, { status: "initial" });
  });

  test("inputValue is reactive", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_2"
    );
    await controller.isHydrated;

    // Create a computed signal that depends on inputValue
    const inputSignal = new Signal.Computed(() => controller.inputValue);
    const watcher = new SignalWatcher(inputSignal);
    watcher.watch();

    assert.strictEqual(inputSignal.get(), "");

    // Mutate the value
    controller.inputValue = "test prompt";
    await controller.isSettled;

    // Verify the signal was updated and watcher was notified
    assert.strictEqual(inputSignal.get(), "test prompt");
    assert.ok(watcher.count > 0, "Signal watcher should have been notified");
  });

  test("state is reactive", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_3"
    );
    await controller.isHydrated;

    // Create a computed signal that derives from state
    const statusSignal = new Signal.Computed(() => controller.state.status);
    const watcher = new SignalWatcher(statusSignal);
    watcher.watch();

    assert.strictEqual(statusSignal.get(), "initial");

    // Transition to generating
    controller.state = { status: "generating" };
    await controller.isSettled;

    assert.strictEqual(statusSignal.get(), "generating");
    assert.ok(watcher.count > 0, "Signal watcher should have been notified");
  });

  test("state is deep-reactive (nested property access)", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_4"
    );
    await controller.isHydrated;

    // Create a computed that reads nested error/suggestedIntent
    const errorInfoSignal = new Signal.Computed(() => {
      const s = controller.state;
      if (s.status === "error") {
        return { error: s.error, suggestedIntent: s.suggestedIntent };
      }
      return null;
    });
    const watcher = new SignalWatcher(errorInfoSignal);
    watcher.watch();

    assert.strictEqual(errorInfoSignal.get(), null);

    // Set error state with suggestedIntent
    controller.state = {
      status: "error",
      error: "Something failed",
      suggestedIntent: "try something else",
    };
    await controller.isSettled;

    const info = errorInfoSignal.get();
    assert.ok(info !== null);
    assert.strictEqual(info.error, "Something failed");
    assert.strictEqual(info.suggestedIntent, "try something else");
    assert.ok(watcher.count > 0, "Watcher should have been notified");
  });

  test("clear() triggers reactivity on both inputValue and state", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_5"
    );
    await controller.isHydrated;

    // Set up initial dirty state
    controller.inputValue = "some text";
    controller.state = { status: "generating" };
    await controller.isSettled;

    // Create computed signals for both properties
    const inputSignal = new Signal.Computed(() => controller.inputValue);
    const statusSignal = new Signal.Computed(() => controller.state.status);
    const inputWatcher = new SignalWatcher(inputSignal);
    const statusWatcher = new SignalWatcher(statusSignal);
    inputWatcher.watch();
    statusWatcher.watch();

    assert.strictEqual(inputSignal.get(), "some text");
    assert.strictEqual(statusSignal.get(), "generating");

    // Clear both
    controller.clear();
    await controller.isSettled;

    assert.strictEqual(inputSignal.get(), "");
    assert.strictEqual(statusSignal.get(), "initial");
    assert.ok(
      inputWatcher.count > 0,
      "Input watcher should have been notified"
    );
    assert.ok(
      statusWatcher.count > 0,
      "Status watcher should have been notified"
    );
  });

  test("multiple state transitions notify watchers", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_6"
    );
    await controller.isHydrated;

    const statusSignal = new Signal.Computed(() => controller.state.status);
    const watcher = new SignalWatcher(statusSignal);
    watcher.watch();

    assert.strictEqual(statusSignal.get(), "initial");

    // Transition: initial -> generating
    controller.state = { status: "generating" };
    await controller.isSettled;
    assert.strictEqual(statusSignal.get(), "generating");
    const countAfterGenerating = watcher.count;
    assert.ok(countAfterGenerating > 0);

    // Re-subscribe the watcher for the next transition
    // (Signal.subtle.Watcher requires explicit re-watching after notifications)
    watcher.watch();

    // Transition: generating -> error
    controller.state = { status: "error", error: "failed" };
    await controller.isSettled;
    assert.strictEqual(statusSignal.get(), "error");
    assert.ok(watcher.count > countAfterGenerating);

    // Re-subscribe for the final transition
    watcher.watch();

    // Transition: error -> initial via clear()
    controller.clear();
    await controller.isSettled;
    assert.strictEqual(statusSignal.get(), "initial");
  });

  // === Phase 5A: New field tests ===

  test("currentExampleIntent has initial value and is reactive", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_7"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.currentExampleIntent, "");

    const intentSignal = new Signal.Computed(
      () => controller.currentExampleIntent
    );
    const watcher = new SignalWatcher(intentSignal);
    watcher.watch();

    controller.currentExampleIntent = "Create a quiz app";
    await controller.isSettled;

    assert.strictEqual(controller.currentExampleIntent, "Create a quiz app");
    assert.ok(watcher.count > 0, "Signal watcher should have been notified");
  });

  test("plannerStatus has initial value and is reactive", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_8"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.plannerStatus, "Creating your app");

    controller.plannerStatus = "Building components...";
    await controller.isSettled;

    assert.strictEqual(controller.plannerStatus, "Building components...");
  });

  test("plannerThought has initial value and is reactive", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_9"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.plannerThought, "Planning ...");

    controller.plannerThought = "Adding input validation...";
    await controller.isSettled;

    assert.strictEqual(controller.plannerThought, "Adding input validation...");
  });

  test("examples returns FLOWGEN_EXAMPLES array", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_10"
    );
    await controller.isHydrated;

    const examples = controller.examples;
    assert.ok(Array.isArray(examples), "examples should be an array");
    assert.ok(examples.length > 0, "examples should not be empty");
    assert.ok(
      examples.every((e) => typeof e.intent === "string"),
      "each example should have an intent string"
    );
  });

  test("isGenerating returns true when state is generating", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_11"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.isGenerating, false);

    controller.state = { status: "generating" };
    await controller.isSettled;

    assert.strictEqual(controller.isGenerating, true);

    controller.state = { status: "initial" };
    await controller.isSettled;

    assert.strictEqual(controller.isGenerating, false);
  });

  test("startGenerating sets state to generating", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_12"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.state.status, "initial");
    assert.strictEqual(controller.isGenerating, false);

    controller.startGenerating();
    await controller.isSettled;

    assert.strictEqual(controller.state.status, "generating");
    assert.strictEqual(controller.isGenerating, true);
  });

  test("clear() resets all new fields including planner state", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_13"
    );
    await controller.isHydrated;

    // Set up dirty state for all new fields
    controller.currentExampleIntent = "Test intent";
    controller.plannerStatus = "Building...";
    controller.plannerThought = "Working on step 3...";
    controller.state = { status: "generating" };
    await controller.isSettled;

    // Verify dirty state
    assert.strictEqual(controller.currentExampleIntent, "Test intent");
    assert.strictEqual(controller.plannerStatus, "Building...");
    assert.strictEqual(controller.plannerThought, "Working on step 3...");
    assert.strictEqual(controller.state.status, "generating");

    // Clear all state
    controller.clear();
    await controller.isSettled;

    // Verify all fields are reset
    assert.strictEqual(controller.inputValue, "");
    assert.strictEqual(controller.currentExampleIntent, "");
    assert.strictEqual(controller.plannerStatus, "Creating your app");
    assert.strictEqual(controller.plannerThought, "Planning ...");
    assert.strictEqual(controller.state.status, "initial");
  });

  // === Intent and clear() tests ===

  test("intent returns empty when status is initial", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_14"
    );
    await controller.isHydrated;

    controller.setIntent("Create a quiz app");
    await controller.isSettled;

    // When status is initial, intent returns empty
    assert.strictEqual(controller.state.status, "initial");
    assert.strictEqual(controller.intent, "");
  });

  test("intent returns value when status is generating", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_15"
    );
    await controller.isHydrated;

    controller.setIntent("Create a quiz app");
    controller.startGenerating();
    await controller.isSettled;

    assert.strictEqual(controller.state.status, "generating");
    assert.strictEqual(controller.intent, "Create a quiz app");
  });

  test("intent returns value when status is error", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_16"
    );
    await controller.isHydrated;

    controller.setIntent("Create a quiz app");
    controller.state = { status: "error", error: "Failed" };
    await controller.isSettled;

    assert.strictEqual(controller.state.status, "error");
    assert.strictEqual(controller.intent, "Create a quiz app");
  });

  test("clear() clears intent and resets state after generating", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_17"
    );
    await controller.isHydrated;

    // Set up generation state
    controller.setIntent("Create a quiz app");
    controller.currentExampleIntent = "Example intent";
    controller.startGenerating();
    await controller.isSettled;

    assert.strictEqual(controller.intent, "Create a quiz app");
    assert.strictEqual(controller.currentExampleIntent, "Example intent");
    assert.strictEqual(controller.state.status, "generating");

    // Clear all state (this is what replaceWithTheme calls after graph replacement)
    controller.clear();
    await controller.isSettled;

    // Intent is cleared (returns empty since status is initial)
    assert.strictEqual(controller.intent, "");
    assert.strictEqual(controller.currentExampleIntent, "");
    assert.strictEqual(controller.state.status, "initial");
  });
});
