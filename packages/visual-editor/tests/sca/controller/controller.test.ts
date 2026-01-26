/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, before, suite, test } from "node:test";
import { appController } from "../../../src/sca/controller/controller.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";
import { defaultRuntimeFlags } from "./data/default-flags.js";

suite("AppController", () => {
  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  // Note: this test must come first since appController stores a singleton
  // instance, which will be used between tests.
  test("Errors without flags", async () => {
    assert.throws(() => {
      appController();
    }, new Error("App Controller must be instantiated with flags"));
  });

  test("Instantiates with flags", async () => {
    assert.doesNotReject(async () => {
      const controller = appController(defaultRuntimeFlags);
      await controller.isHydrated;
    });
  });
});
