/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { EnvironmentFlags } from "../../../src/sca/environment/environment-flags.js";
import { defaultRuntimeFlags } from "../controller/data/default-flags.js";
import { RuntimeFlags } from "@breadboard-ai/types";

let testId = 0;

function makeEnvFlags(env?: RuntimeFlags): EnvironmentFlags {
  testId++;
  return new EnvironmentFlags(
    env ?? defaultRuntimeFlags,
    `EnvFlags_${testId}`,
    `EnvFlags_Persist_${testId}`
  );
}

suite("EnvironmentFlags", () => {
  test("Provides env", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    assert.deepStrictEqual(store.env(), defaultRuntimeFlags);
  });

  test("get() returns env default when no override is set", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, mcp: true };
    const store = makeEnvFlags(env);
    await store.isHydrated;
    await store.isSettled;

    assert.strictEqual(store.get("mcp"), true);
  });

  test("get() returns override when set", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    await store.override("mcp", true);
    await store.isSettled;

    assert.strictEqual(store.get("mcp"), true);
  });

  test("flags() merges env defaults with overrides", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    const allFlagsTrue: RuntimeFlags = { ...defaultRuntimeFlags };
    const envValues = Object.keys(allFlagsTrue) as Array<keyof RuntimeFlags>;

    for (const flag of envValues) {
      await store.override(flag, true);
      allFlagsTrue[flag] = true;
    }
    await store.isSettled;

    const flags = await store.flags();
    assert.deepStrictEqual(flags, allFlagsTrue);
  });

  test("override() persists through isSettled", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    await store.override("consistentUI", true);
    await store.isSettled;

    assert.strictEqual(store.get("consistentUI"), true);
    assert.strictEqual(store._overrides.consistentUI, true);
  });

  test("clearOverride() reverts to env default", async () => {
    const env: RuntimeFlags = { ...defaultRuntimeFlags, mcp: true };
    const store = makeEnvFlags(env);
    await store.isHydrated;
    await store.isSettled;

    // Override to a different value
    await store.override("mcp", false);
    await store.isSettled;
    assert.strictEqual(store.get("mcp"), false);

    // Clear the override
    await store.clearOverride("mcp");
    await store.isSettled;

    // Should now follow env
    assert.strictEqual(store.get("mcp"), true);
  });

  test("overrides() returns only user-set values", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    let overrides = await store.overrides();
    assert.deepStrictEqual(overrides, {});

    await store.override("consistentUI", true);
    await store.override("mcp", true);
    await store.isSettled;

    overrides = await store.overrides();
    assert.deepStrictEqual(overrides, { mcp: true, consistentUI: true });

    await store.clearOverride("mcp");
    await store.isSettled;

    overrides = await store.overrides();
    assert.deepStrictEqual(overrides, { consistentUI: true });
  });

  test("resetAll() clears all overrides", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    await store.override("mcp", true);
    await store.override("force2DGraph", true);
    await store.isSettled;

    store.resetAll();
    await store.isSettled;

    assert.strictEqual(store.get("mcp"), defaultRuntimeFlags.mcp);
    assert.strictEqual(
      store.get("force2DGraph"),
      defaultRuntimeFlags.force2DGraph
    );

    const overrides = await store.overrides();
    assert.deepStrictEqual(overrides, {});
  });

  test("throws for unknown flag key", async () => {
    const store = makeEnvFlags();
    await store.isHydrated;
    await store.isSettled;

    assert.throws(
      () => store.get("nonExistentFlag" as keyof RuntimeFlags),
      /Unknown flag/
    );
  });
});
