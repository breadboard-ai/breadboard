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
} from "../../../../src/controller/decorators/utils/wrap-unwrap.js";

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
