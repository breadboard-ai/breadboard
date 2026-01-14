/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { appController } from "../../src/controller/controller.js";

suite("AppController", () => {
  test("Instantiates", async () => {
    assert.ok(appController);
  });

  test("Debug settings", async () => {
    assert.ok(appController);

    // Default debug settings.
    assert.strictEqual(appController.debug.enabled, false);
    assert.strictEqual(appController.debug.errors, true);
    assert.strictEqual(appController.debug.warnings, true);
    assert.strictEqual(appController.debug.info, true);
    assert.strictEqual(appController.debug.verbose, false);

    // Invert
    appController.debug.enabled = true;
    appController.debug.errors = false;
    appController.debug.warnings = false;
    appController.debug.info = false;
    appController.debug.verbose = true;

    assert.strictEqual(appController.debug.enabled, true);
    assert.strictEqual(appController.debug.errors, false);
    assert.strictEqual(appController.debug.warnings, false);
    assert.strictEqual(appController.debug.info, false);
    assert.strictEqual(appController.debug.verbose, true);

    appController.debug.setLogDefault();
    assert.strictEqual(appController.debug.errors, true);
    assert.strictEqual(appController.debug.warnings, true);
    assert.strictEqual(appController.debug.info, true);
    assert.strictEqual(appController.debug.verbose, false);
  });
});
