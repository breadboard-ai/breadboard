/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { DebugController } from "../../../../../src/sca/controller/subcontrollers/global/debug-controller.js";

suite("DebugController", () => {
  test("Enable and Disable", async () => {
    const store = new DebugController("Debug_1");
    await store.isHydrated;

    store.enabled = true;
    await store.isSettled;
    assert(store.enabled);

    store.enabled = false;
    await store.isSettled;
    assert(!store.enabled);
  });
});
