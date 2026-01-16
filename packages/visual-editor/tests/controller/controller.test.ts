/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, before, suite, test } from "node:test";
import { appController } from "../../src/controller/controller.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

suite("AppController", () => {
  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  test("Instantiates", async () => {
    assert.ok(appController);
  });

  test("Debug settings", async () => {
    assert.ok(appController);

    // Default debug settings.
    assert.strictEqual(appController.global.debug.enabled, false);
    assert.strictEqual(appController.global.debug.errors, true);
    assert.strictEqual(appController.global.debug.warnings, true);
    assert.strictEqual(appController.global.debug.info, true);
    assert.strictEqual(appController.global.debug.verbose, false);

    // Invert
    appController.global.debug.enabled = true;
    appController.global.debug.errors = false;
    appController.global.debug.warnings = false;
    appController.global.debug.info = false;
    appController.global.debug.verbose = true;

    assert.strictEqual(appController.global.debug.enabled, true);
    assert.strictEqual(appController.global.debug.errors, false);
    assert.strictEqual(appController.global.debug.warnings, false);
    assert.strictEqual(appController.global.debug.info, false);
    assert.strictEqual(appController.global.debug.verbose, true);

    appController.global.debug.setLogDefault();
    assert.strictEqual(appController.global.debug.errors, true);
    assert.strictEqual(appController.global.debug.warnings, true);
    assert.strictEqual(appController.global.debug.info, true);
    assert.strictEqual(appController.global.debug.verbose, false);
  });
});
