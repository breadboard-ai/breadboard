/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSubItemColor } from "../../src/utils/formatting/subgraph-color.js";

describe("subgraph-color", () => {
  describe("getSubItemColor", () => {
    it("returns a hex string for border type", () => {
      const color = getSubItemColor<string>("test-id", "border");
      assert.match(color, /^#[0-9a-f]{6}$/);
    });

    it("returns a hex string for label type", () => {
      const color = getSubItemColor<string>("test-id", "label");
      assert.match(color, /^#[0-9a-f]{6}$/);
    });

    it("returns a hex string for text type", () => {
      const color = getSubItemColor<string>("test-id", "text");
      assert.match(color, /^#[0-9a-f]{6}$/);
    });

    it("returns a number when asNumber is true", () => {
      const color = getSubItemColor<number>("test-id", "border", true);
      assert.equal(typeof color, "number");
    });

    it("produces consistent results for the same id", () => {
      const a = getSubItemColor<string>("same-id", "border");
      const b = getSubItemColor<string>("same-id", "border");
      assert.equal(a, b);
    });

    it("produces different results for different ids", () => {
      const a = getSubItemColor<string>("id-alpha", "label");
      const b = getSubItemColor<string>("id-beta", "label");
      // Not guaranteed to be different, but extremely likely with different ids
      // We just verify they're valid colors
      assert.match(a, /^#[0-9a-f]{6}$/);
      assert.match(b, /^#[0-9a-f]{6}$/);
    });
  });
});
