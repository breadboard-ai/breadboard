/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { before, suite, test } from "node:test";
import { SettingsController } from "../../../../../src/controller/subcontrollers/editor/sidebar/settings-controller.js";
import {
  setDebuggableAppController,
  stubAppController,
} from "../../../../../src/controller/utils/logging/logger.js";

suite("SettingsController", () => {
  before(() => {
    setDebuggableAppController(stubAppController);
  });

  test("Basics", async () => {
    const store = new SettingsController("Settings_1");
    await store.isHydrated;

    assert.strictEqual(store.hydrated.get(), true);
  });

  test("Read and write", async () => {
    const store = new SettingsController("Settings_2");
    await store.isHydrated;

    store.section = "console";
    await store.isSettled;
    assert.strictEqual(store.section, "console");

    store.section = "preview";
    await store.isSettled;
    assert.strictEqual(store.section, "preview");
  });
});
