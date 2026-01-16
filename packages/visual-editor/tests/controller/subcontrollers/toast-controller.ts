/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { ToastController } from "../../../src/controller/subcontrollers/toast-controller.js";
import { ToastType } from "../../../src/ui/events/events.js";

suite("SettingsController", () => {
  test("Basics", async () => {
    const store = new ToastController("Toast_1");
    await store.isHydrated;

    assert.strictEqual(store.hydrated.get(), true);
  });

  test("Add and remove", async () => {
    const store = new ToastController("Toast_2");
    await store.isHydrated;

    const id = store.toast("New message", ToastType.ERROR);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 1);
    assert.deepStrictEqual(store.toasts.get(id), {
      message: "New message",
      type: ToastType.ERROR,
      persistent: false,
    });

    store.untoast(id);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 0);
  });

  test("Clears all toasts", async () => {
    const store = new ToastController("Toast_2");
    await store.isHydrated;

    store.toast("New message", ToastType.ERROR);
    store.toast("New message 2", ToastType.ERROR);

    store.untoast();
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 0);
  });

  test("Clears toasts by ID", async () => {
    const store = new ToastController("Toast_3");
    await store.isHydrated;

    const id = store.toast("New message", ToastType.ERROR);
    store.toast("New message 2", ToastType.ERROR);

    store.untoast(id);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 1);
  });

  test("Handles toasts with long titles", async () => {
    const store = new ToastController("Toast_4");
    await store.isHydrated;

    const originalMessage =
      "This is a very long toast string which should be truncated by the ToastController";
    const id = store.toast(originalMessage, ToastType.ERROR);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 1);

    const messageLen =
      store.toasts.get(id)?.message.length ?? Number.POSITIVE_INFINITY;
    assert.ok(messageLen < originalMessage.length);
  });
});
