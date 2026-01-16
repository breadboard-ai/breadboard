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
import { unwrap } from "../../../src/controller/decorators/utils/wrap-unwrap.js";

function clean(a: unknown) {
  return JSON.parse(JSON.stringify(a));
}

suite("Field Decorator", () => {
  test("should initialize with PENDING_HYDRATION and then resolve", async () => {
    class TestController extends RootController {
      @field() accessor name = "default";
    }

    const instance = new TestController("Test");
    assert.strictEqual(instance.name, "default");
  });

  test("should throw for unknown types", async () => {
    assert.throws(() => {
      class FooController extends RootController {
        @field({ persist: "foo" as "local" }) accessor name = "foo";
      }
      new FooController("Foo");
    }, new Error("Unsupported type or not yet implemented"));
  });

  test("should handle persistence and async hydration", async () => {
    class PersistentController extends RootController {
      @field({ persist: "local", deep: false }) accessor foo = "foo";
      @field({ persist: "session", deep: false }) accessor bar = "bar";
      @field({ persist: "idb", deep: false }) accessor baz = "baz";
    }

    // Check on the field hydration.
    const instance = new PersistentController("Persistence");
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
    const instance2 = new PersistentController("Persistence");
    await instance2.isHydrated;
    assert.strictEqual(instance2.foo, "foo2");
    assert.strictEqual(instance2.bar, "foo2");
    assert.strictEqual(instance2.baz, "foo2");
  });

  test("should apply deep reactivity if enabled", async () => {
    class DeepController extends RootController {
      @field({ deep: true }) accessor data = { user: "anon" };
    }

    const instance = new DeepController("Deep_1");
    assert.deepStrictEqual(instance.data, { user: "anon" });
  });

  test("should persist deep objects", async () => {
    class DeepController extends RootController {
      @field({ deep: true, persist: "idb" }) accessor data = { user: "anon" };
    }

    const instance = new DeepController("Deep_2");
    await instance.isHydrated;
    assert.deepStrictEqual(instance.data, { user: "anon" });

    instance.data.user = "anon2";
    await instance.isSettled;
    assert.deepStrictEqual(instance.data, { user: "anon2" });

    const instance2 = new DeepController("Deep_2");
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

    const instance = new ArrayController("Array");
    await instance.isHydrated;
    assert.deepStrictEqual(clean(instance.data), [
      { a: 1 },
      { b: 2 },
      { c: 3 },
    ]);

    // Test replacing the whole object.
    instance.data[1] = { b: 23 };
    await instance.isSettled;

    // And a single value within the array.
    instance.data[2].c = 90;
    await instance.isSettled;
    assert.deepStrictEqual(clean(instance.data), [
      { a: 1 },
      { b: 23 },
      { c: 90 },
    ]);

    const instance2 = new ArrayController("Array");
    await instance2.isHydrated;
    assert.deepStrictEqual(clean(instance2.data), [
      { a: 1 },
      { b: 23 },
      { c: 90 },
    ]);
  });

  test("should persist Maps", async () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);

    const set = new Set([1, 2, 3]);

    class SetMapController extends RootController {
      @field({ deep: true }) accessor map = new Map(map);
      @field({ deep: true }) accessor set = new Set(set);
      @field({ deep: true, persist: "local" }) accessor mapLocal = new Map(map);
      @field({ deep: true, persist: "idb" }) accessor mapIdb = new Map(map);
      @field({ deep: true, persist: "local" }) accessor setLocal = new Set(set);
      @field({ deep: true, persist: "idb" }) accessor setIdb = new Set(set);
    }

    const instance = new SetMapController("Map");
    await instance.isHydrated;

    assert.deepStrictEqual(unwrap(instance.map), map);
    assert.deepStrictEqual(unwrap(instance.mapLocal), map);
    assert.deepStrictEqual(unwrap(instance.mapIdb), map);

    assert.deepStrictEqual(unwrap(instance.set), set);
    assert.deepStrictEqual(unwrap(instance.setLocal), set);
    assert.deepStrictEqual(unwrap(instance.setIdb), set);
  });

  test("should persist nested items", async () => {
    const map = new Map([["a", new Map([["b", "c"]])]]);

    class MapController extends RootController {
      @field({ deep: true }) accessor map = new Map(map);
      @field({ deep: true, persist: "local" }) accessor mapLocal = new Map(map);
      @field({ deep: true, persist: "idb" }) accessor mapIdb = new Map(map);
    }

    const instance = new MapController("Map_2");
    await instance.isHydrated;

    instance.map.get("a")!.set("b", "d");
    instance.mapLocal.get("a")!.set("b", "d");
    instance.mapIdb.get("a")!.set("b", "d");

    await instance.isSettled;

    const mapAdjusted = new Map([["a", new Map([["b", "d"]])]]);

    assert.deepStrictEqual(unwrap(instance.map), mapAdjusted);
    assert.deepStrictEqual(unwrap(instance.mapLocal), mapAdjusted);
    assert.deepStrictEqual(unwrap(instance.mapIdb), mapAdjusted);

    // Check for persistence.
    const instance2 = new MapController("Map_2");
    await instance2.isHydrated;

    assert.deepStrictEqual(unwrap(instance.map), mapAdjusted);
    assert.deepStrictEqual(unwrap(instance.mapLocal), mapAdjusted);
    assert.deepStrictEqual(unwrap(instance.mapIdb), mapAdjusted);
  });
});
