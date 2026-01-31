/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { ScreenSizeController } from "../../../../../src/sca/controller/subcontrollers/global/screen-size-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

suite("ScreenSizeController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Defaults to wide", async () => {
    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_1"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.size, "wide");
  });

  test("size signal can be set externally", async () => {
    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_2"
    );
    await controller.isHydrated;

    // The trigger will set this - verify it works
    controller.size = "narrow";
    await controller.isSettled;
    assert.strictEqual(controller.size, "narrow");

    controller.size = "medium";
    await controller.isSettled;
    assert.strictEqual(controller.size, "medium");
  });
});
