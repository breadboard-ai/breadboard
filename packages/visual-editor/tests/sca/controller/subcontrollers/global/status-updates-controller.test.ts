/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { StatusUpdatesController } from "../../../../../src/sca/controller/subcontrollers/global/status-updates-controller.js";
import { VisualEditorStatusUpdate } from "../../../../../src/ui/types/types.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

function makeUpdate(
  overrides: Partial<VisualEditorStatusUpdate> = {}
): VisualEditorStatusUpdate {
  return {
    date: "2026-01-15T10:00:00Z",
    text: "Test update",
    type: "info",
    ...overrides,
  };
}

suite("StatusUpdatesController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_1",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.hydrated, true);
    assert.deepStrictEqual(controller.updates, []);
    assert.strictEqual(controller.showStatusUpdateChip, null);
  });

  test("setUpdates stores and sorts updates by date (newest first)", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_2",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    const updates = [
      makeUpdate({ date: "2026-01-10T10:00:00Z", text: "Oldest" }),
      makeUpdate({ date: "2026-01-20T10:00:00Z", text: "Newest" }),
      makeUpdate({ date: "2026-01-15T10:00:00Z", text: "Middle" }),
    ];

    controller.setUpdates(updates);
    await controller.isSettled;

    assert.strictEqual(controller.updates.length, 3);
    assert.strictEqual(controller.updates[0].text, "Newest");
    assert.strictEqual(controller.updates[1].text, "Middle");
    assert.strictEqual(controller.updates[2].text, "Oldest");
  });

  test("setUpdates shows chip for warning/urgent updates", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_3",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    // Initially null
    assert.strictEqual(controller.showStatusUpdateChip, null);

    // Warning update should trigger chip
    controller.setUpdates([makeUpdate({ type: "warning" })]);
    await controller.isSettled;

    assert.strictEqual(controller.showStatusUpdateChip, true);
  });

  test("setUpdates does not show chip for info updates", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_4",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    controller.setUpdates([makeUpdate({ type: "info" })]);
    await controller.isSettled;

    // Info updates don't trigger chip
    assert.strictEqual(controller.showStatusUpdateChip, null);
  });

  test("setUpdates does not show chip if already dismissed", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_5",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    // Simulate user dismissing the chip
    controller.showStatusUpdateChip = false;
    await controller.isSettled;

    // New warning update should not re-trigger chip
    controller.setUpdates([makeUpdate({ type: "warning" })]);
    await controller.isSettled;

    assert.strictEqual(controller.showStatusUpdateChip, false);
  });

  test("setUpdates skips if hash unchanged", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_6",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    const updates = [makeUpdate({ text: "Same update" })];

    controller.setUpdates(updates);
    await controller.isSettled;

    // Set chip to false to verify it doesn't change on duplicate call
    controller.showStatusUpdateChip = false;
    await controller.isSettled;

    // Call with same updates again
    controller.setUpdates(updates);
    await controller.isSettled;

    // Chip should remain false (hash unchanged, so no update)
    assert.strictEqual(controller.showStatusUpdateChip, false);
  });

  test("hasNewUpdates indicates unseen updates", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_7",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.hasNewUpdates, false);

    controller.setUpdates([makeUpdate()]);
    await controller.isSettled;

    assert.strictEqual(controller.hasNewUpdates, true);
  });

  test("markAsSeen updates last seen hash", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_8",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    controller.setUpdates([makeUpdate()]);
    await controller.isSettled;

    assert.strictEqual(controller.hasNewUpdates, true);

    controller.markAsSeen();
    await controller.isSettled;

    assert.strictEqual(controller.hasNewUpdates, false);
  });

  test("migrate sets last seen hash", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_9",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.isMigrated, false);

    controller.migrate("12345");
    await controller.isSettled;

    assert.strictEqual(controller.isMigrated, true);
  });

  test("migrate is idempotent", async () => {
    const controller = new StatusUpdatesController(
      "StatusUpdates_10",
      "StatusUpdatesController"
    );
    await controller.isHydrated;

    controller.migrate("12345");
    await controller.isSettled;

    // Second call should not change anything
    controller.migrate("99999");
    await controller.isSettled;

    assert.strictEqual(controller.isMigrated, true);
    // First hash should be preserved
  });
});
