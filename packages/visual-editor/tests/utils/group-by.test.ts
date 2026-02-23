/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupBy } from "../../src/utils/group-by.js";

describe("groupBy", () => {
  it("groups items by key", () => {
    const items = [
      ["a", 1],
      ["b", 2],
      ["c", 1],
    ] as const;
    const result = groupBy(
      items,
      ([, k]) => k,
      ([v]) => v
    );
    assert.deepEqual(result.get(1), ["a", "c"]);
    assert.deepEqual(result.get(2), ["b"]);
  });

  it("returns empty map for empty input", () => {
    const result = groupBy([], () => "key");
    assert.equal(result.size, 0);
  });

  it("uses identity when no valueFn is provided", () => {
    const items = ["apple", "avocado", "banana"];
    const result = groupBy(items, (s) => s[0]);
    assert.deepEqual(result.get("a"), ["apple", "avocado"]);
    assert.deepEqual(result.get("b"), ["banana"]);
  });

  it("works with Map entries (the layout-graph pattern)", () => {
    const depth = new Map([
      ["node-a", 0],
      ["node-b", 1],
      ["node-c", 0],
      ["node-d", 2],
    ]);
    const byDepth = groupBy(
      depth,
      ([_id, d]) => d,
      ([id]) => id
    );
    assert.deepEqual(byDepth.get(0), ["node-a", "node-c"]);
    assert.deepEqual(byDepth.get(1), ["node-b"]);
    assert.deepEqual(byDepth.get(2), ["node-d"]);
  });
});
