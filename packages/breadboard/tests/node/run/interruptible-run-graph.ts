/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, fail } from "node:assert";
import test, { describe } from "node:test";

import type {
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";
import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import { interruptibleRunGraph } from "../../../src/run/interruptible-run-graph.js";
import { RunArguments } from "../../../src/types.js";
import { testKit } from "../test-kit.js";
import { createRunStateManager } from "../../../src/index.js";
import { RunState } from "../../../src/run/types.js";

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
    const script: RunScriptEntry[] = [
      { expected: { type: "input" }, inputs: { text: "Hello" } },
      { expected: { type: "output", outputs: [{ text: "Hello" }] } },
    ];
    let resumeFrom: RunState = [];
    let inputs: InputValues = {};
    for (const [index, scriptEntry] of script.entries()) {
      const state = createRunStateManager(resumeFrom, inputs);
      const args: RunArguments = {
        kits: [testKit],
        state,
      };
      let outputCount = 0;
      let interrupted = false;
      for await (const result of interruptibleRunGraph(graph, args)) {
        const { type } = result;
        const expectedRunResult = scriptEntry;
        deepStrictEqual(
          type,
          expectedRunResult.expected.type,
          `type mismatch at index ${index}`
        );
        if (type === "output") {
          console.log("OUTPUT", result.outputs);
          const expected = expectedRunResult.expected.outputs?.[outputCount];
          if (expected) {
            deepStrictEqual(result.outputs, expected);
          }
          outputCount++;
        } else if (type === "input") {
          interrupted = true;
        }
      }
      if (interrupted) {
        resumeFrom = state.lifecycle().state();
        inputs = scriptEntry.inputs!;
      } else {
        if (index !== script.length - 1) {
          fail("Unexpected end of run");
        }
      }
    }
  });
});
