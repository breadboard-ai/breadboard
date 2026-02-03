/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { GlobalController } from "../../../../../src/sca/controller/subcontrollers/global/global.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import { SignalWatcher } from "../../../../signal-watcher.js";
import { Signal } from "signal-polyfill";

suite("GlobalController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("viewError has initial value of empty string", async () => {
    const controller = new GlobalController("Global", "Global_1");
    await controller.isHydrated;

    assert.strictEqual(controller.viewError, "");
  });

  test("viewError is reactive", async () => {
    const controller = new GlobalController("Global", "Global_2");
    await controller.isHydrated;

    const viewErrorSignal = new Signal.Computed(() => controller.viewError);
    const watcher = new SignalWatcher(viewErrorSignal);
    watcher.watch();

    assert.strictEqual(viewErrorSignal.get(), "");

    controller.viewError = "Unable to load project";
    await controller.isSettled;

    assert.strictEqual(controller.viewError, "Unable to load project");
    assert.strictEqual(viewErrorSignal.get(), "Unable to load project");
    assert.ok(watcher.count > 0, "Signal watcher should have been notified");
  });

  test("viewError can be cleared", async () => {
    const controller = new GlobalController("Global", "Global_3");
    await controller.isHydrated;

    controller.viewError = "Some error";
    await controller.isSettled;
    assert.strictEqual(controller.viewError, "Some error");

    controller.viewError = "";
    await controller.isSettled;
    assert.strictEqual(controller.viewError, "");
  });
});
