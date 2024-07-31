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
import {
  createLoader,
  createRunStateManager,
  RunArguments,
} from "../../src/index.js";
import { interruptibleRunGraph } from "../../src/run/interruptible-run-graph.js";
import { RunState } from "../../src/run/types.js";
import { loadRunnerState } from "../../src/serialization.js";
import { testKit } from "./test-kit.js";

const BGL_DIR = new URL("../../../tests/bgl/test.bgl.json", import.meta.url)
  .href;

export type ExpectedRunState = {
  node: string;
};

export type ExpectedResult = {
  type: string;
  state?: ExpectedRunState[];
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
  graph.url = BGL_DIR;
  let resumeFrom: RunState = [];
  let inputs: InputValues = {};
  for (const [index, scriptEntry] of script.entries()) {
    console.log("🌻🍞 scriptedRun: script entry", index, scriptEntry);
    const state = createRunStateManager(resumeFrom, inputs);
    const args: RunArguments = {
      kits: [testKit],
      state,
      loader: createLoader(),
    };
    let outputCount = 0;
    let interrupted = false;
    for await (const result of interruptibleRunGraph(graph, args)) {
      const { type, path } = result;
      const expectedRunResult = scriptEntry;
      console.log("🌻 scriptedRun: interruptibleRunGraph result", {
        type,
        node: result.node,
        state: result.state,
        path,
      });
      deepStrictEqual(
        type,
        expectedRunResult.expected.type,
        `Script entry ${index}: expected ${expectedRunResult.expected.type}, got ${type}`
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
      if (scriptEntry.expected.state) {
        if (resumeFrom.length !== scriptEntry.expected.state.length) {
          console.log("🌻 scriptedRun: resumeFrom", resumeFrom);
          fail(
            `Script entry ${index}: expected ${scriptEntry.expected.state.length} states in run stack, got ${resumeFrom.length}`
          );
        }
        for (const [
          stackIndex,
          expectedState,
        ] of scriptEntry.expected.state.entries()) {
          const actualState = resumeFrom[stackIndex];
          if (!actualState.state) {
            fail(
              `Script entry ${index}: expected state at run stack index ${stackIndex} `
            );
          }
          const result = await loadRunnerState(actualState.state).state;
          deepStrictEqual(result.descriptor.id, expectedState.node);
        }
      }
      inputs = scriptEntry.inputs!;
    } else {
      if (index !== script.length - 1) {
        fail(`Script entry ${index}: unexpected end of run at`);
      }
    }
  }
}
