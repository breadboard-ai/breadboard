/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { SnackbarController } from "../../../../src/sca/controller/subcontrollers/snackbar-controller.js";
import { SnackType } from "../../../../src/ui/types/types.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";

suite("SnackbarController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics", async () => {
    const controller = new SnackbarController("Snackbar_1");
    await controller.isHydrated;

    assert.strictEqual(controller.hydrated, true);
  });

  test("Add and remove snackbar", async () => {
    const controller = new SnackbarController("Snackbar_2");
    await controller.isHydrated;

    const id = controller.snackbar("Test message", SnackType.INFORMATION);
    await controller.isSettled;

    assert.strictEqual(controller.snackbars.size, 1);
    const snackbar = controller.snackbars.get(id);
    if (!snackbar) assert.fail("Unable to retrieve snackbar");
    assert.strictEqual(snackbar.message, "Test message");
    assert.strictEqual(snackbar.type, SnackType.INFORMATION);
    assert.strictEqual(snackbar.persistent, false);
    assert.deepStrictEqual(snackbar.actions, []);

    controller.unsnackbar(id);
    await controller.isSettled;
    assert.strictEqual(controller.snackbars.size, 0);
  });

  test("Add snackbar with actions", async () => {
    const controller = new SnackbarController("Snackbar_3");
    await controller.isHydrated;

    const actions = [{ title: "Undo", action: "undo" }];
    const id = controller.snackbar(
      "Action taken",
      SnackType.INFORMATION,
      actions,
      true // persistent
    );
    await controller.isSettled;

    const snackbar = controller.snackbars.get(id);
    if (!snackbar) assert.fail("Unable to retrieve snackbar");
    assert.deepStrictEqual(snackbar.actions, actions);
    assert.strictEqual(snackbar.persistent, true);
  });

  test("Clears all snackbars", async () => {
    const controller = new SnackbarController("Snackbar_4");
    await controller.isHydrated;

    controller.snackbar("Message 1", SnackType.ERROR);
    controller.snackbar("Message 2", SnackType.WARNING);
    await controller.isSettled;

    assert.strictEqual(controller.snackbars.size, 2);

    controller.unsnackbar();
    await controller.isSettled;
    assert.strictEqual(controller.snackbars.size, 0);
  });

  test("replaceAll clears existing snackbars", async () => {
    const controller = new SnackbarController("Snackbar_5");
    await controller.isHydrated;

    controller.snackbar("Message 1", SnackType.PENDING);
    controller.snackbar("Message 2", SnackType.PENDING);
    await controller.isSettled;
    assert.strictEqual(controller.snackbars.size, 2);

    // Add a new snackbar with replaceAll=true
    controller.snackbar(
      "New message",
      SnackType.INFORMATION,
      [],
      false,
      globalThis.crypto.randomUUID(),
      true // replaceAll
    );
    await controller.isSettled;

    assert.strictEqual(controller.snackbars.size, 1);
    const [snackbar] = controller.snackbars.values();
    assert.strictEqual(snackbar.message, "New message");
  });

  test("Update existing snackbar", async () => {
    const controller = new SnackbarController("Snackbar_6");
    await controller.isHydrated;

    const id = controller.snackbar("Saving...", SnackType.PENDING);
    await controller.isSettled;

    // Update the snackbar
    const updated = controller.update(id, "Saved!", SnackType.INFORMATION);
    await controller.isSettled;

    assert.strictEqual(updated, true);
    const snackbar = controller.snackbars.get(id);
    if (!snackbar) assert.fail("Unable to retrieve snackbar");
    assert.strictEqual(snackbar.message, "Saved!");
    assert.strictEqual(snackbar.type, SnackType.INFORMATION);
  });

  test("Update returns false for non-existent snackbar", async () => {
    const controller = new SnackbarController("Snackbar_7");
    await controller.isHydrated;

    const updated = controller.update(
      globalThis.crypto.randomUUID(),
      "Test",
      SnackType.INFORMATION
    );

    assert.strictEqual(updated, false);
  });

  test("Supports different snack types", async () => {
    const controller = new SnackbarController("Snackbar_8");
    await controller.isHydrated;

    const types = [
      SnackType.NONE,
      SnackType.INFORMATION,
      SnackType.WARNING,
      SnackType.ERROR,
      SnackType.PENDING,
    ];

    for (const type of types) {
      controller.snackbar(`Message for ${type}`, type);
    }
    await controller.isSettled;

    assert.strictEqual(controller.snackbars.size, types.length);
  });
});
