/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { SignalMap } from "signal-utils/map";
import { SignalSet } from "signal-utils/set";
import { SignalArray } from "signal-utils/array";
import { SignalObject } from "signal-utils/object";
import {
  wrap,
  unwrap,
} from "../../../../../src/sca/controller/decorators/utils/wrap-unwrap.js";
import { html } from "lit";
import { isLitTemplateResult } from "../../../../../src/sca/controller/decorators/utils/is-lit-template.js";

suite("Serialization Utilities", () => {
  suite("wrap()", () => {
    test("should pass through primitives", () => {
      assert.strictEqual(wrap(1), 1);
      assert.strictEqual(wrap("foo"), "foo");
      assert.strictEqual(wrap(true), true);
      assert.strictEqual(wrap(null), null);
      assert.strictEqual(wrap(undefined), undefined);
    });

    test("should wrap Arrays into SignalArray", () => {
      const input = [1, 2, 3];
      const result = wrap(input);
      assert(result instanceof SignalArray);
      assert.deepStrictEqual(
        result.map((x) => x),
        input
      );
    });

    test("should wrap Objects into SignalObject", () => {
      const input = { a: 1, b: 2 };
      const result = wrap(input);
      assert(result instanceof SignalObject);
      // signal-utils SignalObject mimics the object but is an instance of SignalObject
      assert.strictEqual((result as unknown as { a: number }).a, 1);
      assert.strictEqual((result as unknown as { b: number }).b, 2);
    });

    test("should wrap Maps into SignalMap", () => {
      const input = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      const result = wrap(input);
      assert(result instanceof SignalMap);
      assert.strictEqual((result as SignalMap<string, number>).get("a"), 1);
    });

    test("should wrap Sets into SignalSet", () => {
      const input = new Set([1, 2, 3]);
      const result = wrap(input);
      assert(result instanceof SignalSet);
      assert((result as SignalSet<number>).has(1));
    });

    test("should be idempotent (wrapping a Signal* returns itself)", () => {
      const sMap = new SignalMap();
      const sSet = new SignalSet();
      const sArr = new SignalArray([]);
      const sObj = new SignalObject({});

      assert.strictEqual(wrap(sMap), sMap);
      assert.strictEqual(wrap(sSet), sSet);
      assert.strictEqual(wrap(sArr), sArr);
      assert.strictEqual(wrap(sObj), sObj);
    });

    test("should recursively wrap nested structures", () => {
      const input = {
        list: [1, { val: 2 }],
        map: new Map([["key", new Set([1])]]),
      };

      const result = wrap(input) as unknown;

      assert(result instanceof SignalObject);
      assert(result.list instanceof SignalArray);
      assert(result.list[1] instanceof SignalObject);
      assert(result.map instanceof SignalMap);
      assert(result.map.get("key") instanceof SignalSet);
    });

    test("should not wrap class instances", () => {
      class Foo {
        bar = 1;
      }
      const input = new Foo();
      const result = wrap(input);
      assert.strictEqual(result, input);
      assert(!(result instanceof SignalObject));
    });

    test("should not wrap HTMLTemplateInstances", () => {
      const input = html`Template String`;
      const result = wrap(input);
      assert.strictEqual(result, input);
      assert(isLitTemplateResult(result));
    });
  });

  suite("unwrap()", () => {
    test("should pass through primitives", () => {
      assert.strictEqual(unwrap(1), 1);
      assert.strictEqual(unwrap("foo"), "foo");
      assert.strictEqual(unwrap(true), true);
      assert.strictEqual(unwrap(null), null);
    });

    test("should unwrap SignalArray to Array", () => {
      const input = new SignalArray([1, 2, 3]);
      const result = unwrap(input);
      assert(Array.isArray(result));
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    test("should unwrap SignalObject to Object", () => {
      const input = new SignalObject({ a: 1 });
      const result = unwrap(input);
      assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
      assert.deepStrictEqual(result, { a: 1 });
    });

    test("should unwrap SignalMap to Map", () => {
      const input = new SignalMap([["a", 1]]);
      const result = unwrap(input);
      assert(result instanceof Map);
      assert.deepStrictEqual(Array.from(result.entries()), [["a", 1]]);
    });

    test("should unwrap SignalSet to Set", () => {
      const input = new SignalSet([1, 2]);
      const result = unwrap(input);
      assert(result instanceof Set);
      assert.deepStrictEqual(Array.from(result), [1, 2]);
    });

    test("should recursively unwrap nested Signal structures", () => {
      const sSet = new SignalSet([1]);
      const sMap = new SignalMap([["nested", sSet]]);
      const sArr = new SignalArray([sMap]);
      const sObj = new SignalObject({ root: sArr });

      const result = unwrap(sObj) as Record<string, unknown>;

      assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
      assert(Array.isArray(result.root));
      assert(result.root[0] instanceof Map);
      assert(result.root[0].get("nested") instanceof Set);
      assert(result.root[0].get("nested").has(1));
    });

    test("should handle mixed Signal and native structures gracefully", () => {
      // e.g. a plain object inside a SignalMap
      const input = new SignalMap([["key", { a: 1 }]]);
      const result = unwrap(input) as Map<string, unknown>;

      assert(result instanceof Map);
      assert.deepStrictEqual(result.get("key"), { a: 1 });
    });
  });
});

/**
 * Tests for deep-wrapping safeguards.
 *
 * When `wrap()` produces a SignalMap, SignalSet, SignalArray, or SignalObject,
 * subsequent mutations (set, add, index assignment, property assignment) must
 * automatically wrap new POJO values.  This prevents reactivity bugs where
 * unwrapped nested objects bypass signal tracking.
 */
suite("Deep-wrapping safeguards", () => {
  suite("DeepSignalMap", () => {
    test("set() auto-wraps POJO values", () => {
      const map = wrap(new Map()) as SignalMap<string, unknown>;
      map.set("key", { nested: true });

      const value = map.get("key");
      assert(
        value instanceof SignalObject,
        "POJO set on DeepSignalMap should be auto-wrapped to SignalObject"
      );
    });

    test("set() auto-wraps nested arrays", () => {
      const map = wrap(new Map()) as SignalMap<string, unknown>;
      map.set("arr", [1, 2, 3]);

      const value = map.get("arr");
      assert(
        value instanceof SignalArray,
        "Array set on DeepSignalMap should be auto-wrapped to SignalArray"
      );
    });

    test("set() auto-wraps nested Maps", () => {
      const map = wrap(new Map()) as SignalMap<string, unknown>;
      map.set("inner", new Map([["a", 1]]));

      const value = map.get("inner");
      assert(
        value instanceof SignalMap,
        "Map set on DeepSignalMap should be auto-wrapped to SignalMap"
      );
    });

    test("set() passes through primitives", () => {
      const map = wrap(new Map()) as SignalMap<string, unknown>;
      map.set("num", 42);
      map.set("str", "hello");

      assert.strictEqual(map.get("num"), 42);
      assert.strictEqual(map.get("str"), "hello");
    });

    test("set() is idempotent for already-wrapped values", () => {
      const map = wrap(new Map()) as SignalMap<string, unknown>;
      const existingSignalObj = new SignalObject({ x: 1 });
      map.set("obj", existingSignalObj);

      assert.strictEqual(
        map.get("obj"),
        existingSignalObj,
        "Already-wrapped SignalObject should pass through unchanged"
      );
    });
  });

  suite("DeepSignalSet", () => {
    test("add() auto-wraps POJO values", () => {
      const set = wrap(new Set()) as SignalSet<unknown>;
      const pojo = { nested: true };
      set.add(pojo);

      // The POJO should be wrapped, so the original reference is not in the set
      assert(
        !set.has(pojo),
        "Original POJO should not be in the set (it was wrapped)"
      );
      // But the set should have one item
      assert.strictEqual(set.size, 1);

      // The item in the set should be a SignalObject
      const [item] = set;
      assert(
        item instanceof SignalObject,
        "POJO added to DeepSignalSet should be auto-wrapped to SignalObject"
      );
    });

    test("add() passes through primitives", () => {
      const set = wrap(new Set()) as SignalSet<unknown>;
      set.add(42);
      set.add("hello");

      assert(set.has(42));
      assert(set.has("hello"));
    });
  });

  suite("Deep SignalArray", () => {
    test("index assignment auto-wraps POJOs", () => {
      const arr = wrap([]) as SignalArray<unknown>;
      arr.push(null); // ensure index 0 exists
      arr[0] = { nested: true };

      assert(
        arr[0] instanceof SignalObject,
        "POJO assigned to array index should be auto-wrapped to SignalObject"
      );
    });

    test("instanceof SignalArray works on deep-wrapped array", () => {
      const arr = wrap([1, 2, 3]) as SignalArray<number>;
      assert(
        arr instanceof SignalArray,
        "Deep-wrapped array should pass instanceof SignalArray"
      );
    });

    test("unwrap works on deep-wrapped array", () => {
      const arr = wrap([1, { a: 2 }]) as SignalArray<unknown>;
      const plain = unwrap(arr);

      assert(Array.isArray(plain));
      assert.deepStrictEqual(plain, [1, { a: 2 }]);
    });

    test("nested arrays in initial data are recursively wrapped", () => {
      const arr = wrap([[1, 2], [3]]) as SignalArray<unknown>;

      assert(arr[0] instanceof SignalArray, "Nested array should be wrapped");
      assert(arr[1] instanceof SignalArray, "Nested array should be wrapped");
    });
  });

  suite("Deep SignalObject", () => {
    test("property assignment auto-wraps POJOs", () => {
      const obj = wrap({ key: null }) as Record<string, unknown>;
      obj.key = { nested: true };

      assert(
        obj.key instanceof SignalObject,
        "POJO assigned to property should be auto-wrapped to SignalObject"
      );
    });

    test("instanceof SignalObject works on deep-wrapped object", () => {
      const obj = wrap({ a: 1 });
      assert(
        obj instanceof SignalObject,
        "Deep-wrapped object should pass instanceof SignalObject"
      );
    });

    test("unwrap works on deep-wrapped object", () => {
      const obj = wrap({ a: 1, b: { c: 2 } });
      const plain = unwrap(obj);

      assert.deepStrictEqual(plain, { a: 1, b: { c: 2 } });
      assert.strictEqual(
        Object.getPrototypeOf(plain),
        Object.prototype,
        "Unwrapped result should be a plain object"
      );
    });

    test("nested objects in initial data are recursively wrapped", () => {
      const obj = wrap({ inner: { deep: true } }) as Record<string, unknown>;

      assert(
        obj.inner instanceof SignalObject,
        "Nested object should be wrapped"
      );
    });
  });

  suite("wrap/unwrap round-trip with deep-wrapped collections", () => {
    test("Map with nested POJOs survives round-trip", () => {
      const original = new Map<string, unknown>([
        ["a", { x: 1 }],
        ["b", [1, 2]],
      ]);

      const wrapped = wrap(original);
      const unwrapped = unwrap(wrapped) as Map<string, unknown>;

      assert(unwrapped instanceof Map);
      assert.deepStrictEqual(unwrapped.get("a"), { x: 1 });
      assert.deepStrictEqual(unwrapped.get("b"), [1, 2]);
    });

    test("deeply nested structure survives round-trip", () => {
      const original = {
        items: [
          { name: "first", tags: new Set(["a", "b"]) },
          { name: "second", meta: new Map([["key", "val"]]) },
        ],
      };

      const wrapped = wrap(original);
      const unwrapped = unwrap(wrapped) as typeof original;

      assert.strictEqual(unwrapped.items[0].name, "first");
      assert(unwrapped.items[0].tags instanceof Set);
      assert(unwrapped.items[0].tags.has("a"));
      assert.strictEqual(unwrapped.items[1].name, "second");
      assert(unwrapped.items[1].meta instanceof Map);
      assert.strictEqual(unwrapped.items[1].meta.get("key"), "val");
    });
  });
});
