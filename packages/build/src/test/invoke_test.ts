/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeHandlerContext } from "@google-labs/breadboard";
import assert from "node:assert/strict";
import { test } from "node:test";
import { defineNodeType } from "../internal/define/define.js";

test("invoke receives context", async () => {
  const expected: NodeHandlerContext = {
    base: new URL("http://example.com/"),
    outerGraph: { nodes: [], edges: [] },
  };
  let actual: NodeHandlerContext | undefined;
  defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {},
    invoke: (_staticInputs, _dynamicInputs, context) => {
      actual = context;
      return {};
    },
  }).invoke({}, expected);
  assert.deepEqual(actual, expected);
});
