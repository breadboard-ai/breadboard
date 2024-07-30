/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";
import { deepStrictEqual, fail } from "assert";
import { createRunStateManager, RunArguments } from "../../src/index.js";
import { interruptibleRunGraph } from "../../src/run/interruptible-run-graph.js";
import { RunState } from "../../src/run/types.js";
import { testKit } from "./test-kit.js";

export type ExpectedResult = {
  type: string;
  outputs?: OutputValues[];
};

export type RunScriptEntry = {
  inputs?: InputValues;
  expected: ExpectedResult;
};

export async function interruptibleScriptedRun(
  g: unknown,
  script: RunScriptEntry[]
) {
  const graph = g as GraphDescriptor;
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
        fail(`Unexpected end of run at index ${index}`);
      }
    }
  }
}
