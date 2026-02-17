/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { GraphAssetImpl } from "../../../src/sca/utils/graph-asset.js";
import type { Asset, AssetPath } from "@breadboard-ai/types";

suite("GraphAssetImpl", () => {
  test("stores path, data, and metadata", () => {
    const asset = {
      data: [{ parts: [{ text: "hello" }] }],
      metadata: { title: "Test Asset", type: "content" },
    } as unknown as Asset;
    const impl = new GraphAssetImpl("asset://test" as AssetPath, asset);

    assert.strictEqual(impl.path, "asset://test");
    assert.deepStrictEqual(impl.data, [{ parts: [{ text: "hello" }] }]);
    assert.deepStrictEqual(impl.metadata, {
      title: "Test Asset",
      type: "content",
    });
  });

  test("handles missing metadata", () => {
    const asset = {
      data: [{ parts: [{ text: "hello" }] }],
    } as unknown as Asset;
    const impl = new GraphAssetImpl("asset://no-meta" as AssetPath, asset);

    assert.strictEqual(impl.path, "asset://no-meta");
    assert.strictEqual(impl.metadata, undefined);
  });

  test("handles empty data array", () => {
    const asset = {
      data: [],
      metadata: { title: "Empty" },
    } as unknown as Asset;
    const impl = new GraphAssetImpl("asset://empty" as AssetPath, asset);

    assert.deepStrictEqual(impl.data, []);
    assert.strictEqual(impl.metadata?.title, "Empty");
  });
});
