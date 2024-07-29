/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, fail } from "node:assert";
import test, { describe } from "node:test";
import { runGraph } from "../../../src/run/run-graph.js";

import type {
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";
import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import { interruptibleRunGraph } from "../../../src/run/interruptible-run-graph.js";

type ExpectedResult = {
  type: string;
  outputs?: OutputValues[];
};

type RunScriptEntry = {
  inputs?: InputValues;
  expected: ExpectedResult;
};

describe("interruptibleRunGraph end-to-end", async () => {
  test("simple graph", async () => {
    const graph = simple as GraphDescriptor;
    const args = {};
    const script: RunScriptEntry[] = [
      { expected: { type: "input" }, inputs: { text: "Hello" } },
    ];
    for (const [index, scriptEntry] of script.entries()) {
      for await (const result of interruptibleRunGraph(graph, args)) {
        const { type } = result;
        const expectedRunResult = scriptEntry;
        deepStrictEqual(
          type,
          expectedRunResult.expected.type,
          `type mismatch at index ${index}`
        );
      }
    }
  });
});
