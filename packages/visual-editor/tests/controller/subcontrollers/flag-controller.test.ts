/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { FlagController } from "../../../src/controller/subcontrollers/flag-controller.js";
import { defaultRuntimeFlags } from "../data/default-flags.js";
import { RuntimeFlags } from "@breadboard-ai/types";

suite("FlagController", () => {
  test("Provides env", async () => {
    const store = new FlagController("Flags_1", defaultRuntimeFlags);
    await store.isHydrated;

    assert.deepStrictEqual(store.env(), defaultRuntimeFlags);
  });

  test("Provides all flags", async () => {
    const store = new FlagController("Flags_2", defaultRuntimeFlags);
    await store.isHydrated;

    const allFlagsTrue: RuntimeFlags = { ...defaultRuntimeFlags };
    const envValues = Object.keys(allFlagsTrue) as Array<keyof RuntimeFlags>;

    // Flip all values to true and wait for the write.
    envValues.forEach((flag) => {
      store.override(flag, true);
      allFlagsTrue[flag] = true;
    });
    await store.isSettled;

    const flags = await store.flags();
    assert.deepStrictEqual(flags, allFlagsTrue);
  });

  test("Allows overrides", async () => {
    const store = new FlagController("Flags_3", defaultRuntimeFlags);
    await store.isHydrated;

    let overrides = await store.overrides();
    assert.deepStrictEqual(overrides, {});

    store.override("consistentUI", true);
    store.override("agentMode", true);
    await store.isSettled;

    overrides = await store.overrides();
    assert.deepStrictEqual(overrides, { agentMode: true, consistentUI: true });

    await store.clearOverride("agentMode");
    await store.isSettled;

    overrides = await store.overrides();
    assert.deepStrictEqual(overrides, { consistentUI: true });
  });
});
