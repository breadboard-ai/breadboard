/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { FlowgenInputController } from "../../../../../src/sca/controller/subcontrollers/global/flowgen-input-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

suite("FlowgenInputController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_1"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.hydrated, true);
    assert.strictEqual(controller.inputValue, "");
    assert.deepStrictEqual(controller.state, { status: "initial" });
  });

  test("Set and get input value", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_2"
    );
    await controller.isHydrated;

    controller.setInputValue("test prompt");
    await controller.isSettled;

    assert.strictEqual(controller.inputValue, "test prompt");
  });

  test("Set and get state - generating", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_3"
    );
    await controller.isHydrated;

    controller.setState({ status: "generating" });
    await controller.isSettled;

    assert.deepStrictEqual(controller.state, { status: "generating" });
  });

  test("Set and get state - error", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_4"
    );
    await controller.isHydrated;

    const errorState = {
      status: "error" as const,
      error: new Error("test error"),
      suggestedIntent: "try something else",
    };
    controller.setState(errorState);
    await controller.isSettled;

    assert.strictEqual(controller.state.status, "error");
    if (controller.state.status === "error") {
      assert.ok(controller.state.error instanceof Error);
      assert.strictEqual(controller.state.suggestedIntent, "try something else");
    }
  });

  test("Clear resets value and state", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_5"
    );
    await controller.isHydrated;

    controller.setInputValue("some prompt text");
    controller.setState({ status: "generating" });
    await controller.isSettled;

    assert.strictEqual(controller.inputValue, "some prompt text");
    assert.deepStrictEqual(controller.state, { status: "generating" });

    controller.clear();
    await controller.isSettled;

    assert.strictEqual(controller.inputValue, "");
    assert.deepStrictEqual(controller.state, { status: "initial" });
  });

  test("Multiple state transitions", async () => {
    const controller = new FlowgenInputController(
      "FlowgenInput",
      "FlowgenInput_6"
    );
    await controller.isHydrated;

    // Start with initial
    assert.deepStrictEqual(controller.state, { status: "initial" });

    // Transition to generating
    controller.setState({ status: "generating" });
    await controller.isSettled;
    assert.deepStrictEqual(controller.state, { status: "generating" });

    // Transition to error
    controller.setState({ status: "error", error: "failed" });
    await controller.isSettled;
    assert.strictEqual(controller.state.status, "error");

    // Clear back to initial
    controller.clear();
    await controller.isSettled;
    assert.deepStrictEqual(controller.state, { status: "initial" });
  });
});
