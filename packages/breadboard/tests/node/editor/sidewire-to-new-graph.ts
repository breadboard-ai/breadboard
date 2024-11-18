/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { ok, testEditGraph } from "./test-graph.js";
import { SidewireToNewGraphTransform } from "../../../src/editor/transforms/sidewire-to-new-graph.js";
import { deepStrictEqual } from "assert";

describe("SidewireToNewGraphTransform", async () => {
  await it("correctly creates new subgraph with sidewire", async () => {
    const editor = testEditGraph();
    const sidewired = await editor.apply(
      new SidewireToNewGraphTransform(
        "node0",
        "$side",
        "",
        "foo",
        ["node2"],
        "Hello",
        "World"
      )
    );
    ok(sidewired);

    deepStrictEqual(editor.raw().nodes.length, 1);
    deepStrictEqual(editor.raw().nodes[0].configuration?.$side, "foo");
    deepStrictEqual(editor.raw().graphs?.foo.title, "Hello");
    deepStrictEqual(editor.raw().graphs?.foo.description, "World");
    deepStrictEqual(editor.raw().graphs?.foo.nodes.length, 1);
  });
});
