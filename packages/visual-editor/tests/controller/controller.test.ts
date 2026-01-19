/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, before, suite, test } from "node:test";
import {
  AppController,
  appController,
} from "../../src/controller/controller.js";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { defaultRuntimeFlags } from "./data/default-flags.js";

suite("AppController", () => {
  let controller: AppController;
  before(() => {
    setDOM();
    controller = appController(defaultRuntimeFlags);
  });

  after(() => {
    unsetDOM();
  });

  test("Instantiates", async () => {
    assert.ok(controller);
  });

  test("Debug settings", async () => {
    assert.ok(controller);

    // Default debug settings.
    assert.strictEqual(controller.global.debug.enabled, false);
    assert.strictEqual(controller.global.debug.errors, true);
    assert.strictEqual(controller.global.debug.warnings, true);
    assert.strictEqual(controller.global.debug.info, true);
    assert.strictEqual(controller.global.debug.verbose, false);

    // Invert
    controller.global.debug.enabled = true;
    controller.global.debug.errors = false;
    controller.global.debug.warnings = false;
    controller.global.debug.info = false;
    controller.global.debug.verbose = true;

    assert.strictEqual(controller.global.debug.enabled, true);
    assert.strictEqual(controller.global.debug.errors, false);
    assert.strictEqual(controller.global.debug.warnings, false);
    assert.strictEqual(controller.global.debug.info, false);
    assert.strictEqual(controller.global.debug.verbose, true);

    controller.global.debug.setLogDefault();
    assert.strictEqual(controller.global.debug.errors, true);
    assert.strictEqual(controller.global.debug.warnings, true);
    assert.strictEqual(controller.global.debug.info, true);
    assert.strictEqual(controller.global.debug.verbose, false);
  });
});
