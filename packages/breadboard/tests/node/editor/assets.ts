/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { testEditGraph } from "./test-graph.js";
import { deepStrictEqual, ok } from "node:assert";

describe("Asset editing", () => {
  it("can add, remove, and change assets", async () => {
    const editor = testEditGraph();
    {
      const result = await editor.edit(
        [{ type: "addasset", path: "foo", data: "HELLO" }],
        ""
      );
      ok(result.success);
      const graph = editor.raw();
      const assets = graph.assets?.["foo"];
      ok(assets);
      deepStrictEqual(assets.data, "HELLO");
    }
    {
      const result = await editor.edit(
        [
          {
            type: "changeassetmetadata",
            path: "foo",
            metadata: { title: "Foo", type: "content" },
          },
        ],
        ""
      );
      ok(result.success);
      const graph = editor.raw();
      const asset = graph.assets?.["foo"];
      ok(asset);
      deepStrictEqual(asset.data, "HELLO");
      deepStrictEqual(asset?.metadata, { title: "Foo", type: "content" });
    }
    {
      const result = await editor.edit(
        [{ type: "removeasset", path: "foo" }],
        ""
      );
      ok(result.success);
      const graph = editor.raw();
      const assets = graph.assets;
      ok(!assets);
    }
  });
});
