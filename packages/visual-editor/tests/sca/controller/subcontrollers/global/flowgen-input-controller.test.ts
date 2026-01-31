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
});
