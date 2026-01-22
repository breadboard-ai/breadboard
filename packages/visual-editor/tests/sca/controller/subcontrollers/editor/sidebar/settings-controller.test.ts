/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { before, suite, test } from "node:test";
import { SidebarController } from "../../../../../../src/sca/controller/subcontrollers/editor/sidebar/sidebar-controller.js";
import {
  setDebuggableAppController,
  stubAppController,
} from "../../../../../../src/sca/utils/logging/logger.js";

suite("SidebarController", () => {
  before(() => {
    setDebuggableAppController(stubAppController);
  });

  test("Basics", async () => {
    const store = new SidebarController("Settings_1");
    await store.isHydrated;

    assert.strictEqual(store.hydrated, true);
  });

  test("Read and write", async () => {
    const store = new SidebarController("Settings_2");
    await store.isHydrated;

    store.section = "console";
    await store.isSettled;
    assert.strictEqual(store.section, "console");

    store.section = "preview";
    await store.isSettled;
    assert.strictEqual(store.section, "preview");
  });
});
