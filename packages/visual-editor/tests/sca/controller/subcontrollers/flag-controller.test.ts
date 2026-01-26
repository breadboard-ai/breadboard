/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { FlagController } from "../../../../src/sca/controller/subcontrollers/flag-controller.js";
import { defaultRuntimeFlags } from "../data/default-flags.js";
import { RuntimeFlags } from "@breadboard-ai/types";

suite("FlagController", () => {
  test("Provides env", async () => {
    const store = new FlagController("Flags_1", defaultRuntimeFlags);
    await store.isHydrated;
    await store.isSettled;

    assert.deepStrictEqual(store.env(), defaultRuntimeFlags);
  });

  test("Provides all flags", async () => {
    const store = new FlagController("Flags_2", defaultRuntimeFlags);
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
    const store = new FlagController("Flags_3", defaultRuntimeFlags);
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

  test("Throws for unset overrides", async () => {
    const store = new FlagController("Flags_4", {} as RuntimeFlags);
    await store.isHydrated;
    await store.isSettled;

    assert.throws(
      () => String(store.agentMode),
      new Error("agentMode was not set by environment")
    );

    assert.throws(
      () => String(store.consistentUI),
      new Error("consistentUI was not set by environment")
    );

    assert.throws(
      () => String(store.enableDrivePickerInLiteMode),
      new Error("enableDrivePickerInLiteMode was not set by environment")
    );

    assert.throws(
      () => String(store.force2DGraph),
      new Error("force2DGraph was not set by environment")
    );

    assert.throws(
      () => String(store.generateForEach),
      new Error("generateForEach was not set by environment")
    );

    assert.throws(
      () => String(store.googleOne),
      new Error("googleOne was not set by environment")
    );

    assert.throws(
      () => String(store.gulfRenderer),
      new Error("gulfRenderer was not set by environment")
    );

    assert.throws(
      () => String(store.mcp),
      new Error("mcp was not set by environment")
    );

    assert.throws(
      () => String(store.opalAdk),
      new Error("opalAdk was not set by environment")
    );

    assert.throws(
      () => String(store.outputTemplates),
      new Error("outputTemplates was not set by environment")
    );

    assert.throws(
      () => String(store.requireConsentForGetWebpage),
      new Error("requireConsentForGetWebpage was not set by environment")
    );

    assert.throws(
      () => String(store.requireConsentForOpenWebpage),
      new Error("requireConsentForOpenWebpage was not set by environment")
    );

    assert.throws(
      () => String(store.streamGenWebpage),
      new Error("streamGenWebpage was not set by environment")
    );

    assert.throws(
      () => String(store.streamPlanner),
      new Error("streamPlanner was not set by environment")
    );
  });
});
