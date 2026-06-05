/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { WorkbenchController } from "../../../../../../src/sca/controller/subcontrollers/editor/workbench/workbench-controller.js";
import { setDOM, unsetDOM } from "../../../../../fake-dom.js";

suite("WorkbenchController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("initializes with default values", async () => {
    const ctrl = new WorkbenchController("test_1", "WorkbenchController");
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.eligible, false);
    assert.strictEqual(ctrl.view, "workbench");
    assert.strictEqual(ctrl.runsOpen, false);
  });

  test("allows modifying eligible", async () => {
    const ctrl = new WorkbenchController("test_2", "WorkbenchController");
    await ctrl.isHydrated;
    ctrl.eligible = true;
    assert.strictEqual(ctrl.eligible, true);
  });

  test("allows modifying view and runsOpen", async () => {
    const ctrl = new WorkbenchController("test_3", "WorkbenchController");
    await ctrl.isHydrated;
    ctrl.view = "classic";
    ctrl.runsOpen = true;

    assert.strictEqual(ctrl.view, "classic");
    assert.strictEqual(ctrl.runsOpen, true);
  });

  test("initializes splitter with default values", async () => {
    const ctrl = new WorkbenchController("test_4", "WorkbenchController");
    await ctrl.isHydrated;

    assert.ok(ctrl.splitter);
    assert.strictEqual(ctrl.splitter.split, 0.5);
    assert.strictEqual(ctrl.splitter.minLeftPixelWidth, 350);
    assert.strictEqual(ctrl.splitter.minRightPixelWidth, 350);
  });

  test("allows modifying splitter split with clamping limits", async () => {
    const ctrl = new WorkbenchController("test_5", "WorkbenchController");
    await ctrl.isHydrated;

    // Set valid split
    ctrl.splitter.setSplit(0.6);
    assert.strictEqual(ctrl.splitter.split, 0.6);

    // Clamp to max (0.8)
    ctrl.splitter.setSplit(0.95);
    assert.strictEqual(ctrl.splitter.split, 0.8);

    // Clamp to min (0.2)
    ctrl.splitter.setSplit(0.05);
    assert.strictEqual(ctrl.splitter.split, 0.2);
  });

  test("clamps values based on pixel bounds in getClampedValues", async () => {
    const ctrl = new WorkbenchController("test_6", "WorkbenchController");
    await ctrl.isHydrated;

    // Viewport width = 1000px, split = 0.5
    // Left = 500px, Right = 500px. Both are >= min (350px).
    // No clamping should occur.
    const bounds = { width: 1000 } as DOMRectReadOnly;
    let [left, right] = ctrl.splitter.getClampedValues(0.5, bounds);
    assert.strictEqual(left, 0.5);
    assert.strictEqual(right, 0.5);

    // Viewport width = 1000px, split = 0.9
    // Left = 900px, Right = 100px. Right is < min (350px).
    // Clamps Right to 350px (0.35 fr) and Left to 650px (0.65 fr).
    [left, right] = ctrl.splitter.getClampedValues(0.9, bounds);
    assert.strictEqual(right, 0.35);
    assert.strictEqual(left, 0.65);

    // Viewport width = 1000px, split = 0.1
    // Left = 100px, Right = 900px. Left is < min (350px).
    // Clamps Left to 350px (0.35 fr) and Right to 650px (0.65 fr).
    [left, right] = ctrl.splitter.getClampedValues(0.1, bounds);
    assert.strictEqual(left, 0.35);
    assert.strictEqual(right, 0.65);
  });
});
