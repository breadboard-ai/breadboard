/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { FlagController } from "../../../../../src/sca/controller/subcontrollers/global/flag-controller.js";
import { EnvironmentFlags } from "../../../../../src/sca/environment/environment-flags.js";
import { defaultRuntimeFlags } from "../../data/default-flags.js";
import { RuntimeFlags } from "@breadboard-ai/types";

let testId = 0;

function makeFlags(env?: RuntimeFlags): {
  envFlags: EnvironmentFlags;
  store: FlagController;
} {
  testId++;
  const envFlags = new EnvironmentFlags(
    env ?? defaultRuntimeFlags,
    `FC_EnvFlags_${testId}`,
    `FC_EnvFlags_Persist_${testId}`
  );
  const store = new FlagController(
    `FC_Flags_${testId}`,
    `FC_FlagController_${testId}`,
    envFlags
  );
  return { envFlags, store };
}

suite("FlagController", () => {
  test("Provides env", async () => {
    const { store, envFlags } = makeFlags();
    await envFlags.isHydrated;
    await store.isHydrated;
    await store.isSettled;

    assert.deepStrictEqual(store.env(), defaultRuntimeFlags);
  });

  test("Provides all flags", async () => {
    const { store, envFlags } = makeFlags();
    await envFlags.isHydrated;
    await store.isHydrated;
    await store.isSettled;

    const allFlagsTrue: RuntimeFlags = { ...defaultRuntimeFlags };
    const envValues = Object.keys(allFlagsTrue) as Array<keyof RuntimeFlags>;

    envValues.forEach((flag) => {
      store.override(flag, true);
      allFlagsTrue[flag] = true;
    });
    await store.isSettled;
    await envFlags.isSettled;

    const flags = await store.flags();
    assert.deepStrictEqual(flags, allFlagsTrue);
  });

  test("Allows overrides", async () => {
    const { store, envFlags } = makeFlags();
    await envFlags.isHydrated;
    await store.isHydrated;
    await store.isSettled;

    let overrides = await store.overrides();
    assert.deepStrictEqual(overrides, {});

    store.override("consistentUI", true);
    store.override("agentMode", true);
    await envFlags.isSettled;

    overrides = await store.overrides();
    assert.deepStrictEqual(overrides, { agentMode: true, consistentUI: true });

    await store.clearOverride("agentMode");
    await envFlags.isSettled;

    overrides = await store.overrides();
    assert.deepStrictEqual(overrides, { consistentUI: true });
  });

  test("Returns env default when not overridden", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, agentMode: true };
    const { store, envFlags } = makeFlags(env);
    await envFlags.isHydrated;
    await store.isHydrated;
    await store.isSettled;

    assert.strictEqual(store.agentMode, true);
  });

  test("Clears override to follow env", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, agentMode: true };
    const { store, envFlags } = makeFlags(env);
    await envFlags.isHydrated;
    await store.isHydrated;
    await store.isSettled;

    await store.override("agentMode", false);
    await envFlags.isSettled;
    assert.strictEqual(store.agentMode, false);

    await store.clearOverride("agentMode");
    await envFlags.isSettled;

    assert.strictEqual(store.agentMode, true);

    const overrides = await store.overrides();
    assert.strictEqual(overrides.agentMode, undefined);
  });

  test("Delegates get to EnvironmentFlags", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, mcp: true };
    const { store, envFlags } = makeFlags(env);
    await envFlags.isHydrated;
    await store.isHydrated;
    await store.isSettled;

    assert.strictEqual(store.mcp, true);
  });
});
