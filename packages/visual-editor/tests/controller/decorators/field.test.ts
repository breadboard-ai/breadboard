/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { field } from "../../../src/controller/decorators/field.js";
import { RootController } from "../../../src/controller/subcontrollers/root-controller.js";
import { isHydrating } from "../../../src/controller/utils/hydration.js";

function clean(a: unknown) {
  return JSON.parse(JSON.stringify(a));
}

suite("Field Decorator", () => {
  test("should initialize with PENDING_HYDRATION and then resolve", async () => {
    class TestController extends RootController {
      @field() accessor name = "default";
    }

    const instance = new TestController();
    assert.strictEqual(instance.name, "default");
  });

  test("should throw for unknown types", async () => {
    assert.throws(() => {
      class FooController extends RootController {
        @field({ persist: "foo" as "local" }) accessor name = "foo";
      }
      new FooController();
    }, new Error("Unsupported type or not yet implemented"));
  });

  test("should handle persistence and async hydration", async () => {
    class PersistentController extends RootController {
      @field({ persist: "local", deep: false }) accessor foo = "foo";
      @field({ persist: "session", deep: false }) accessor bar = "bar";
      @field({ persist: "idb", deep: false }) accessor baz = "baz";
    }

    // Check on the field hydration.
    const instance = new PersistentController();
    assert(isHydrating(instance.foo));
    assert(isHydrating(instance.bar));
    assert(isHydrating(instance.baz));
    await instance.isHydrated;

    // Should be the default values.
    assert.strictEqual(instance.foo, "foo");
    assert.strictEqual(instance.bar, "bar");
    assert.strictEqual(instance.baz, "baz");

    // Now update all values.
    instance.foo = "foo2";
    instance.bar = "foo2";
    instance.baz = "foo2";
    await instance.isSettled;

    // Check on the field persistence by instantiating a new version.
    const instance2 = new PersistentController();
    await instance2.isHydrated;
    assert.strictEqual(instance2.foo, "foo2");
    assert.strictEqual(instance2.bar, "foo2");
    assert.strictEqual(instance2.baz, "foo2");
  });

  test("should apply deep reactivity if enabled", async () => {
    class DeepController extends RootController {
      @field({ deep: true }) accessor data = { user: "anon" };
    }

    const instance = new DeepController();
    assert.deepStrictEqual(instance.data, { user: "anon" });
  });

  test("should persist deep objects", async () => {
    class DeepController extends RootController {
      @field({ deep: true, persist: "idb" }) accessor data = { user: "anon" };
    }

    const instance = new DeepController();
    await instance.isHydrated;
    assert.deepStrictEqual(instance.data, { user: "anon" });

    instance.data.user = "anon2";
    await instance.isSettled;
    assert.deepStrictEqual(instance.data, { user: "anon2" });

    const instance2 = new DeepController();
    await instance2.isHydrated;
    assert.deepStrictEqual(instance2.data, { user: "anon2" });
  });

  test("should persist deep arrays", async () => {
    class ArrayController extends RootController {
      @field({ deep: true, persist: "idb" }) accessor data = [
        { a: 1 },
        { b: 2 },
        { c: 3 },
      ];
    }

    const instance = new ArrayController();
    await instance.isHydrated;
    assert.deepStrictEqual(clean(instance.data), [
      { a: 1 },
      { b: 2 },
      { c: 3 },
    ]);

    instance.data[1] = { b: 23 };
    await instance.isSettled;
    assert.deepStrictEqual(clean(instance.data), [
      { a: 1 },
      { b: 23 },
      { c: 3 },
    ]);

    const instance2 = new ArrayController();
    await instance2.isHydrated;
    assert.deepStrictEqual(clean(instance2.data), [
      { a: 1 },
      { b: 23 },
      { c: 3 },
    ]);
  });
});
