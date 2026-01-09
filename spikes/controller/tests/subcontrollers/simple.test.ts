/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { SimpleStore } from "../../src/controller/subcontrollers/simple/simple.js";

suite("SimpleStore", () => {
  test("Basics", async () => {
    const store = new SimpleStore();
    await store.isHydrated;

    assert.strictEqual(store.hydrated.get(), true);
  });
});
