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
    assert.deepStrictEqual(ctrl.splits, [1, 2, 1]);
  });

  test("allows modifying eligible", async () => {
    const ctrl = new WorkbenchController("test_2", "WorkbenchController");
    await ctrl.isHydrated;
    ctrl.eligible = true;
    assert.strictEqual(ctrl.eligible, true);
  });

  test("allows modifying view and splits", async () => {
    const ctrl = new WorkbenchController("test_3", "WorkbenchController");
    await ctrl.isHydrated;
    ctrl.view = "classic";
    ctrl.splits = [1, 3, 1];

    assert.strictEqual(ctrl.view, "classic");
    assert.deepStrictEqual(ctrl.splits, [1, 3, 1]);
  });
});
