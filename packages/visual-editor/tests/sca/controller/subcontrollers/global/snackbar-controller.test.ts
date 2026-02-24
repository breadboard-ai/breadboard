/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { SnackbarController } from "../../../../../src/sca/controller/subcontrollers/global/snackbar-controller.js";
import { SnackType } from "../../../../../src/ui/types/types.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

suite("SnackbarController", () => {
  const DEFAULT_TIMEOUT = 100;

  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics", async () => {
    const controller = new SnackbarController(
      "Snackbar_1",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    assert.strictEqual(controller.hydrated, true);
  });

  test("Add and remove snackbar", async () => {
    const controller = new SnackbarController(
      "Snackbar_2",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
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
    const controller = new SnackbarController(
      "Snackbar_3",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
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
    const controller = new SnackbarController(
      "Snackbar_4",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
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
    const controller = new SnackbarController(
      "Snackbar_5",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
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
    const controller = new SnackbarController(
      "Snackbar_6",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
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
    const controller = new SnackbarController(
      "Snackbar_7",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const updated = controller.update(
      globalThis.crypto.randomUUID(),
      "Test",
      SnackType.INFORMATION
    );

    assert.strictEqual(updated, false);
  });

  test("Supports different snack types", async () => {
    const controller = new SnackbarController(
      "Snackbar_8",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
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

  test("Non-persistent snackbar is removed after timeout", async () => {
    const controller = new SnackbarController(
      "Snackbar_9",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const id = controller.snackbar("Will disappear", SnackType.INFORMATION);
    await controller.isSettled;
    assert.strictEqual(controller.snackbars.size, 1);

    // Wait for the timeout to fire
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT + 50));
    await controller.isSettled;

    assert.strictEqual(
      controller.snackbars.has(id),
      false,
      "Entry should be deleted after timeout"
    );
  });

  test("Persistent snackbar has no timeout", async () => {
    const controller = new SnackbarController(
      "Snackbar_10",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const id = controller.snackbar(
      "Persistent",
      SnackType.ERROR,
      [],
      true // persistent
    );
    await controller.isSettled;

    // Wait longer than the timeout — should still be present
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT + 50));
    await controller.isSettled;

    assert.strictEqual(
      controller.snackbars.has(id),
      true,
      "Persistent snackbar should not be removed"
    );
  });

  test("Update from persistent to non-persistent starts timeout", async () => {
    const controller = new SnackbarController(
      "Snackbar_11",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const id = controller.snackbar(
      "Start persistent",
      SnackType.ERROR,
      [],
      true // persistent
    );
    await controller.isSettled;

    // Update to non-persistent
    controller.update(id, "Now auto-dismissing", SnackType.INFORMATION, false);
    await controller.isSettled;

    const snackbar = controller.snackbars.get(id);
    if (!snackbar) assert.fail("Unable to retrieve snackbar");
    assert.strictEqual(snackbar.persistent, false);

    // Wait for timeout
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT + 50));
    await controller.isSettled;

    assert.strictEqual(
      controller.snackbars.has(id),
      false,
      "Entry should be deleted after timeout"
    );
  });

  test("Update resets timeout", async () => {
    const controller = new SnackbarController(
      "Snackbar_12",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const id = controller.snackbar("Will disappear", SnackType.INFORMATION);
    await controller.isSettled;

    // Wait for most of the timeout
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT - 20));

    // Update should restart the timeout
    controller.update(id, "Refreshed", SnackType.INFORMATION);
    await controller.isSettled;

    const refreshed = controller.snackbars.get(id);
    if (!refreshed) assert.fail("Snackbar was removed too early");
    assert.strictEqual(refreshed.message, "Refreshed");

    // Wait for original timeout — should still be present (new timeout running)
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(
      controller.snackbars.has(id),
      true,
      "Entry should still exist (timeout was reset)"
    );

    // Wait for the new timeout to fire
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT));
    await controller.isSettled;
    assert.strictEqual(
      controller.snackbars.has(id),
      false,
      "Entry should be deleted after new timeout"
    );
  });

  test("Adding persistent snackbar cancels existing non-persistent timeout", async () => {
    const controller = new SnackbarController(
      "Snackbar_13",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const nonPersistentId = controller.snackbar(
      "Will be held open",
      SnackType.INFORMATION
    );
    await controller.isSettled;

    // Add a persistent snackbar — should cancel the non-persistent timeout
    controller.snackbar("Error!", SnackType.ERROR, [], true);
    await controller.isSettled;

    // Wait beyond the original timeout — should still be present
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT + 50));
    await controller.isSettled;

    assert.strictEqual(
      controller.snackbars.has(nonPersistentId),
      true,
      "Non-persistent entry should be held open by persistent sibling"
    );
  });

  test("Removing persistent snackbar restarts non-persistent timeouts", async () => {
    const controller = new SnackbarController(
      "Snackbar_14",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    const nonPersistentId = controller.snackbar(
      "Waiting",
      SnackType.INFORMATION
    );
    const persistentId = controller.snackbar(
      "Error!",
      SnackType.ERROR,
      [],
      true
    );
    await controller.isSettled;

    // Non-persistent should still be present while persistent is present
    assert.strictEqual(controller.snackbars.has(nonPersistentId), true);

    // Remove the persistent entry — non-persistent should restart its timeout
    controller.unsnackbar(persistentId);
    await controller.isSettled;

    assert.strictEqual(controller.snackbars.has(nonPersistentId), true);

    // Wait for timeout — should be removed
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT + 50));
    await controller.isSettled;

    assert.strictEqual(
      controller.snackbars.has(nonPersistentId),
      false,
      "Entry should be deleted after restarted timeout"
    );
  });

  test("Non-persistent snackbar added after persistent gets no timeout", async () => {
    const controller = new SnackbarController(
      "Snackbar_15",
      "SnackbarController",
      DEFAULT_TIMEOUT
    );
    await controller.isHydrated;

    // Add persistent first
    controller.snackbar("Error!", SnackType.ERROR, [], true);
    await controller.isSettled;

    // Add non-persistent — should NOT get a timeout while persistent is present
    const nonPersistentId = controller.snackbar("Info", SnackType.INFORMATION);
    await controller.isSettled;

    // Wait beyond timeout — should still be present
    await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT + 50));
    await controller.isSettled;

    assert.strictEqual(
      controller.snackbars.has(nonPersistentId),
      true,
      "Non-persistent entry should be held open by persistent sibling"
    );
  });
});
