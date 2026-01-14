/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { before, suite, test } from "node:test";
import { SettingsController } from "../../../../../src/controller/subcontrollers/editor/sidebar/settings.js";
import { setDebuggableAppController } from "../../../../../src/controller/utils/logging/logger.js";

suite("SettingsController", () => {
  before(() => {
    setDebuggableAppController({
      debug: {
        enabled: false,
        errors: true,
        info: true,
        verbose: true,
        warnings: true,
        setLogDefault() {
          // Stubbed.
        },
      },
    });
  });

  test("Basics", async () => {
    const store = new SettingsController();
    await store.isHydrated;

    assert.strictEqual(store.hydrated.get(), true);
  });

  test("Read and write", async () => {
    const store = new SettingsController();
    await store.isHydrated;

    store.section = "console";
    await store.pendingWritesSettled;
    assert.strictEqual(store.section, "console");

    store.section = "preview";
    await store.pendingWritesSettled;
    assert.strictEqual(store.section, "preview");
  });
});
