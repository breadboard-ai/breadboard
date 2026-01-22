/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { ToastController } from "../../../../src/sca/controller/subcontrollers/toast-controller.js";
import { ToastType } from "../../../../src/ui/events/events.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";

suite("ToastController", () => {
  const DEFAULT_TIMEOUT = 100;

  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics", async () => {
    const store = new ToastController("Toast_1", DEFAULT_TIMEOUT);
    await store.isHydrated;

    assert.strictEqual(store.hydrated, true);
  });

  test("Add and remove", async () => {
    const store = new ToastController("Toast_2", DEFAULT_TIMEOUT);
    await store.isHydrated;

    const id = store.toast("New message", ToastType.ERROR);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 1);
    const toast = store.toasts.get(id);
    if (!toast) assert.fail("Unable to retrieve toast");
    assert.deepStrictEqual(toast.message, "New message");
    assert.deepStrictEqual(toast.type, ToastType.ERROR);
    assert.deepStrictEqual(toast.persistent, false);
    assert.deepStrictEqual(toast.state, "active");
    assert.ok(toast.timeoutId);

    store.untoast(id);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 0);
  });

  test("Clears all toasts", async () => {
    const store = new ToastController("Toast_3", DEFAULT_TIMEOUT);
    await store.isHydrated;

    store.toast("New message", ToastType.ERROR);
    store.toast("New message 2", ToastType.ERROR);

    store.untoast();
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 0);
  });

  test("Clears toasts by ID", async () => {
    const store = new ToastController("Toast_4", DEFAULT_TIMEOUT);
    await store.isHydrated;

    const id = store.toast("New message", ToastType.ERROR);
    store.toast("New message 2", ToastType.ERROR);

    store.untoast(id);
    await store.isSettled;
    assert.strictEqual(store.toasts.size, 1);
  });

  test("Handles toasts with long titles", async () => {
    const store = new ToastController("Toast_5", DEFAULT_TIMEOUT);
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
