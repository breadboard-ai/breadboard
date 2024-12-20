/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@breadboard-ai/types";
import { deepStrictEqual, fail } from "assert";
import {
  createLoader,
  createRunStateManager,
  MutableGraphStore,
  RunArguments,
  runGraph,
} from "../../src/index.js";
import { ReanimationState } from "../../src/run/types.js";
import { loadRunnerState } from "../../src/serialization.js";
import { testKit } from "./test-kit.js";

const BGL_DIR = new URL("../../../tests/bgl/test.bgl.json", import.meta.url)
  .href;

export type ExpectedRunState = { node: string };

export type ExpectedResult = {
  type: string;
  state?: Record<string, ExpectedRunState>;
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
  let resumeFrom: ReanimationState = {};
  let inputs: InputValues | undefined;
  for (const [index, scriptEntry] of script.entries()) {
    // TODO: Move inputs into the current scriptEntry, rather than the previous
    // one.
    const state = createRunStateManager(resumeFrom, inputs);
    const loader = createLoader();
    const args: RunArguments = {
      kits: [testKit],
      state,
      loader,
      graphStore: loader as unknown as MutableGraphStore,
    };
    let outputCount = 0;
    let interrupted = false;
    for await (const result of runGraph({ graph }, args)) {
      const { type } = result;
      const expectedRunResult = scriptEntry;
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
        break;
      }
    }
    if (interrupted) {
      const reanimationState = state.lifecycle().reanimationState();
      if (scriptEntry.expected.state) {
        for (const [key, expectedState] of Object.entries(
          scriptEntry.expected.state
        )) {
          const entry = reanimationState?.states?.[key];
          if (!entry) {
            fail(`Script entry ${index}: expected state at path "${key}"`);
          }
          const state = entry?.state;
          if (!state) {
            fail(`Script entry ${index}: expected state at path "${key}"`);
          }
          const result = loadRunnerState(state).state;
          deepStrictEqual(result.descriptor.id, expectedState.node);
        }
      }
      inputs = scriptEntry.inputs;
      resumeFrom = reanimationState;
    } else {
      if (index !== script.length - 1) {
        fail(`Script entry ${index}: unexpected end of run at`);
      }
    }
  }
}
