/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { typesMatch } from "../../../../src/controller/decorators/utils/types-match.js";

suite("Type Validation", () => {
  test("should match primitives", () => {
    assert.strictEqual(typesMatch("initial", "loaded"), true);
    assert.strictEqual(typesMatch(123, 456), true);
    assert.strictEqual(typesMatch(true, false), true);
  });

  test("should fail mismatched primitives", () => {
    assert.strictEqual(typesMatch("string", 123), false);
    assert.strictEqual(typesMatch(true, "true"), false);
    assert.strictEqual(typesMatch(1, { a: 1 }), false);
  });

  test("should match complex types", () => {
    assert.strictEqual(typesMatch([], [1, 2]), true);
    assert.strictEqual(typesMatch(new Map(), new Map([["a", 1]])), true);
    assert.strictEqual(typesMatch(new Set(), new Set([1])), true);
    assert.strictEqual(typesMatch({}, { a: 1 }), true);
  });

  test("should fail mismatched complex types", () => {
    assert.strictEqual(typesMatch([], {}), false);
    assert.strictEqual(typesMatch(new Set(), []), false);
    assert.strictEqual(typesMatch(new Map(), new Set()), false);
    assert.strictEqual(typesMatch({}, new Map()), false);
  });

  test("should allow loaded value if initial is null/undefined", () => {
    // If the developer initializes a field as null, we can't infer the type,
    // so we trust the storage.
    assert.strictEqual(typesMatch(null, "foo"), true);
    assert.strictEqual(typesMatch(undefined, 123), true);
    assert.strictEqual(typesMatch(null, new Map()), true);
  });

  test("should allow null/undefined loaded values", () => {
    assert.strictEqual(typesMatch("foo", null), true);
    assert.strictEqual(typesMatch(123, undefined), true);
  });
});
