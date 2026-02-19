/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { ScreenController } from "../../../../../src/sca/controller/subcontrollers/run/screen-controller.js";
import { createAppScreen } from "../../../../../src/sca/utils/app-screen.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

/**
 * Tests for the ScreenController.
 *
 * The ScreenController owns per-node screen state during a run,
 * tracking screen instances for rendering in the app panel.
 */
suite("ScreenController screen management", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("screens defaults to empty Map", async () => {
    const controller = new ScreenController("ScreenTest_1", "ScreenController");
    await controller.isHydrated;

    assert.strictEqual(controller.screens.size, 0);
  });

  test("setScreen adds a screen", async () => {
    const controller = new ScreenController("ScreenTest_2", "ScreenController");
    await controller.isHydrated;

    const screen = createAppScreen("Test Node", undefined);
    controller.setScreen("node-1", screen);
    await controller.isSettled;

    assert.strictEqual(controller.screens.size, 1);
    assert.ok(controller.screens.has("node-1"));
    // DeepSignalMap wraps on set(), so the stored value is a SignalObject.
    // Verify content identity via title.
    assert.strictEqual(controller.screens.get("node-1")?.title, "Test Node");
  });

  test("screens.get returns screen by id", async () => {
    const controller = new ScreenController("ScreenTest_3", "ScreenController");
    await controller.isHydrated;

    const screen = createAppScreen("Test Node", undefined);
    controller.setScreen("node-1", screen);
    await controller.isSettled;

    assert.strictEqual(controller.screens.get("node-1")?.title, "Test Node");
    assert.strictEqual(controller.screens.get("node-2"), undefined);
  });

  test("deleteScreen removes a screen", async () => {
    const controller = new ScreenController("ScreenTest_4", "ScreenController");
    await controller.isHydrated;

    const screen = createAppScreen("Test Node", undefined);
    controller.setScreen("node-1", screen);
    await controller.isSettled;

    const deleted = controller.deleteScreen("node-1");
    await controller.isSettled;

    assert.strictEqual(deleted, true);
    assert.strictEqual(controller.screens.size, 0);
  });

  test("deleteScreen returns false for nonexistent screen", async () => {
    const controller = new ScreenController("ScreenTest_5", "ScreenController");
    await controller.isHydrated;

    const deleted = controller.deleteScreen("nonexistent");
    assert.strictEqual(deleted, false);
  });

  test("bumpScreen moves screen to end of map", async () => {
    const controller = new ScreenController("ScreenTest_6", "ScreenController");
    await controller.isHydrated;

    const screenA = createAppScreen("Node A", undefined);
    const screenB = createAppScreen("Node B", undefined);
    controller.setScreen("node-a", screenA);
    controller.setScreen("node-b", screenB);
    await controller.isSettled;

    // Verify initial order
    const initialKeys = [...controller.screens.keys()];
    assert.deepStrictEqual(initialKeys, ["node-a", "node-b"]);

    // Bump node-a to the end
    controller.bumpScreen("node-a");
    await controller.isSettled;

    const newKeys = [...controller.screens.keys()];
    assert.deepStrictEqual(newKeys, ["node-b", "node-a"]);
  });

  test("bumpScreen does nothing for nonexistent screen", async () => {
    const controller = new ScreenController("ScreenTest_7", "ScreenController");
    await controller.isHydrated;

    const screen = createAppScreen("Test", undefined);
    controller.setScreen("node-1", screen);
    await controller.isSettled;

    controller.bumpScreen("nonexistent");
    assert.strictEqual(controller.screens.size, 1);
  });
});

suite("ScreenController reset", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("reset clears all screens", async () => {
    const controller = new ScreenController(
      "ScreenTest_reset_1",
      "ScreenController"
    );
    await controller.isHydrated;

    controller.setScreen("node-1", createAppScreen("A", undefined));
    controller.setScreen("node-2", createAppScreen("B", undefined));
    await controller.isSettled;

    controller.reset();
    await controller.isSettled;

    assert.strictEqual(controller.screens.size, 0);
  });
});
