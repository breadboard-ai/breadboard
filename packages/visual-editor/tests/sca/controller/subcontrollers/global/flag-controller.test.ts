/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { FlagController } from "../../../../../src/sca/controller/subcontrollers/global/flag-controller.js";
import { defaultRuntimeFlags } from "../../data/default-flags.js";
import { RuntimeFlags } from "@breadboard-ai/types";

suite("FlagController", () => {
  test("Provides env", async () => {
    const store = new FlagController(
      "Flags_1",
      "FlagController",
      defaultRuntimeFlags
    );
    await store.isHydrated;
    await store.isSettled;

    assert.deepStrictEqual(store.env(), defaultRuntimeFlags);
  });

  test("Provides all flags", async () => {
    const store = new FlagController(
      "Flags_2",
      "FlagController",
      defaultRuntimeFlags
    );
    await store.isHydrated;
    await store.isSettled;

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
    const store = new FlagController(
      "Flags_3",
      "FlagController",
      defaultRuntimeFlags
    );
    await store.isHydrated;
    await store.isSettled;

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

  test("Returns env default when not overridden", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, agentMode: true };
    const store = new FlagController("Flags_4", "FlagController", env);
    await store.isHydrated;
    await store.isSettled;

    // No override set, should return env value
    assert.strictEqual(store.agentMode, true);
  });

  test("Clears override to follow env", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, agentMode: true };
    const store = new FlagController(
      "Flags_clearOverride",
      "FlagController",
      env
    );
    await store.isHydrated;
    await store.isSettled;

    // Override to a different value
    await store.override("agentMode", false);
    await store.isSettled;
    assert.strictEqual(store.agentMode, false);

    // Clear the override
    await store.clearOverride("agentMode");
    await store.isSettled;

    // Should now follow env
    assert.strictEqual(store.agentMode, true);

    // And not appear in overrides
    const overrides = await store.overrides();
    assert.strictEqual(overrides.agentMode, undefined);
  });

  test("Throws for truly unset flags (no override and no env)", async () => {
    const store = new FlagController(
      "Flags_unset",
      "FlagController",
      {} as RuntimeFlags
    );
    await store.isHydrated;
    await store.isSettled;

    // Both internal value and env are undefined/null, should throw
    assert.throws(
      () => String(store.agentMode),
      new Error("agentMode was not set by environment")
    );
  });
});
