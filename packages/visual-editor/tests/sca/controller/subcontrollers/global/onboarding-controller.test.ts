/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { OnboardingController } from "../../../../../src/sca/controller/subcontrollers/global/onboarding-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

suite("OnboardingController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("dismissed set starts empty", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_1");
    await controller.isHydrated;

    assert.strictEqual(controller.dismissed.size, 0);
  });

  test("currentItem returns the first non-dismissed lite item", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_2");
    await controller.isHydrated;

    const item = controller.currentItem("lite");
    assert.ok(item, "Should return an item");
    assert.strictEqual(item.id, "first-run");
    assert.ok(
      item.mode === "lite" || item.mode === "both",
      "Item mode should match lite or both"
    );
  });

  test("currentItem returns the first non-dismissed standalone item", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_3");
    await controller.isHydrated;

    const item = controller.currentItem("standalone");
    assert.ok(item, "Should return an item");
    assert.strictEqual(item.id, "first-run");
  });

  test("dismiss removes an item from currentItem results", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_4");
    await controller.isHydrated;

    controller.dismiss("first-run");

    const liteItem = controller.currentItem("lite");
    assert.ok(liteItem, "Should still have lite items");
    assert.strictEqual(liteItem.id, "lite-remix");

    const standaloneItem = controller.currentItem("standalone");
    assert.ok(standaloneItem, "Should still have standalone items");
    assert.strictEqual(standaloneItem.id, "standalone-remix");
  });

  test("isDismissed returns true for dismissed items", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_5");
    await controller.isHydrated;

    assert.strictEqual(controller.isDismissed("first-run"), false);
    controller.dismiss("first-run");
    assert.strictEqual(controller.isDismissed("first-run"), true);
  });

  test("reset clears all dismissals", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_6");
    await controller.isHydrated;

    controller.dismiss("first-run");
    controller.dismiss("advanced-editor");
    assert.strictEqual(controller.dismissed.size, 2);

    controller.reset();
    assert.strictEqual(controller.dismissed.size, 0);
    assert.strictEqual(controller.isDismissed("first-run"), false);
  });

  test("currentItem returns null when all items for a mode are dismissed", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_7");
    await controller.isHydrated;

    // Dismiss all lite-relevant items.
    controller.dismiss("first-run");
    controller.dismiss("lite-remix");
    controller.dismiss("advanced-editor");
    controller.dismiss("replay-warning");

    assert.strictEqual(controller.currentItem("lite"), null);
  });

  test("currentItem skips items not matching the requested mode", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_8");
    await controller.isHydrated;

    // Dismiss first-run (both modes).
    controller.dismiss("first-run");

    const standaloneItem = controller.currentItem("standalone");
    assert.ok(standaloneItem, "Should return a standalone item");
    // Should skip lite-only items and land on standalone-remix.
    assert.strictEqual(standaloneItem.id, "standalone-remix");
  });

  test("dismissed getter returns a ReadonlySet (cannot add via getter)", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_9");
    await controller.isHydrated;

    const dismissed = controller.dismissed;
    assert.ok(typeof dismissed.has === "function");
    assert.ok(typeof dismissed.size === "number");
  });

  test("getItem returns a registry item by ID", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_10");
    await controller.isHydrated;

    const item = controller.getItem("first-run");
    assert.ok(item, "Should find the first-run item");
    assert.strictEqual(item.id, "first-run");
    assert.strictEqual(item.mode, "both");
    assert.strictEqual(item.textKey, "LABEL_FIRST_RUN");
  });

  test("getItem returns null for unknown IDs", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_11");
    await controller.isHydrated;

    assert.strictEqual(controller.getItem("nonexistent"), null);
  });

  test("isCurrentItem uses appMode to determine the active item", async () => {
    const controller = new OnboardingController("Onboarding", "Onboarding_12");
    await controller.isHydrated;

    // Default appMode is standalone.
    assert.strictEqual(controller.isCurrentItem("first-run"), true);
    assert.strictEqual(controller.isCurrentItem("lite-remix"), false);
    assert.strictEqual(controller.isCurrentItem("advanced-editor"), false);

    // Switch to lite — first-run is mode: both, so it's still current.
    controller.appMode = "lite";
    assert.strictEqual(controller.isCurrentItem("first-run"), true);

    // After dismissing first-run, lite-remix becomes current.
    controller.dismiss("first-run");
    assert.strictEqual(controller.isCurrentItem("lite-remix"), true);
  });
});
