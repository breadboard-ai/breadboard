/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { notOk, ok, testEditGraph, testSubGraph } from "./test-graph.js";
import { ConfigureSidewireTransform } from "../../../src/editor/transforms/configure-sidewire.js";
import { deepStrictEqual } from "node:assert";

describe("ConfigureSidewireTransform", async () => {
  await it("refuses to sidewire to non-existent subgraph", async () => {
    const editor = testEditGraph();
    const sidewired = await editor.apply(
      new ConfigureSidewireTransform("node0", "$side", "", "foo")
    );
    notOk(sidewired);
  });

  await it("refuses to sidewire non-existent node", async () => {
    const editor = testEditGraph();
    await editor.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    const sidewired = await editor.apply(
      new ConfigureSidewireTransform("node4", "$side", "", "foo")
    );
    notOk(sidewired);
  });

  await it("correctly creates sidewires", async () => {
    const editor = testEditGraph();
    await editor.edit(
      [{ type: "addgraph", graph: testSubGraph(), id: "foo" }],
      ""
    );
    const sidewired = await editor.apply(
      new ConfigureSidewireTransform("node0", "$side", "", "foo")
    );
    ok(sidewired);
    deepStrictEqual(editor.raw().nodes[0].configuration?.$side, "foo");
  });
});
