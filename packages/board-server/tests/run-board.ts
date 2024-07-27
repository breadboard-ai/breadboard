/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { deepStrictEqual, fail, ok } from "assert";
import { runBoard } from "../src/server/boards/utils/run-board.js";
import type { GraphDescriptor, Kit } from "@google-labs/breadboard";

import simpleBoard from "./boards/simple.bgl.json" with { type: "json" };
import multipleInputsBoard from "./boards/many-inputs.bgl.json" with { type: "json" };
import manyOutputsBoard from "./boards/many-outputs.bgl.json" with { type: "json" };
import invokeWithBubblingInput from "./boards/invoke-board-with-bubbling-input.bgl.json" with { type: "json" };
import type { RunBoardResult } from "../src/server/types.js";

const mockSecretsKit: Kit = {
  url: import.meta.url,
  handlers: {
    secrets: async () => {
      throw new Error("Secrets aren't implemented in tests.");
    },
  },
};

const assertResult = (
  result: RunBoardResult,
  expected: ExpectedResult,
  index = 0
) => {
  if ("$error" in result) {
    fail(`Unexpected error: ${result.$error}`);
  }
  ok(result.$state);
  const { type, outputs } = expected;
  deepStrictEqual(
    result.$state.type,
    type,
    `Expected state type to be ${type} at index ${index}`
  );
  if (result.$state.type === "input" || result.$state.type === "output") {
    const state = JSON.parse(result.$state.next);
    ok(Array.isArray(state), `Expected state to be an array at index ${index}`);
  }
  if (expected.outputs) {
    const { $state, ...expectedOutputs } = result;
    deepStrictEqual(
      outputs,
      expectedOutputs,
      `Expected outputs to match at index ${index}`
    );
  }
};

const getNext = (result: RunBoardResult) => {
  if ("$error" in result) {
    fail(result.$error);
  }
  ok(result.$state);
  if (result.$state.type === "input" || result.$state.type === "output") {
    return result.$state.next;
  }
  if (result.$state.type === "end") {
    return undefined;
  }
  fail("Unexpected state type.");
};

type ExpectedResult = {
  type: string;
  outputs?: Record<string, any>;
};

type RunScriptEntry = {
  inputs?: Record<string, any>;
  expected: ExpectedResult;
};

const scriptedRun = async (
  board: GraphDescriptor,
  script: RunScriptEntry[]
) => {
  let next;
  const path = "/path/to/board";
  for (const [index, { inputs, expected }] of script.entries()) {
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      loader: async () => board,
      inputs,
      next,
    });
    assertResult(result, expected, index);
    next = getNext(result);
  }
};

describe("Board Server Runs Boards", () => {
  test("can start a simple board", async () => {
    const path = "/path/to/board";
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      loader: async () => simpleBoard,
    });
    assertResult(result, { type: "input" });
  });

  test("can finish a simple board", async () => {
    await scriptedRun(simpleBoard, [
      { expected: { type: "input" } },
      { inputs: { text: "foo" }, expected: { type: "output" } },
      { expected: { type: "end" } },
    ]);
  });

  test("can start a simple board with inputs", async () => {
    const path = "/path/to/board";
    const inputs = { text: "bar" };
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => simpleBoard,
    });
    assertResult(result, {
      type: "output",
      outputs: {
        text: "bar",
      },
    });
  });

  test("can start a board with multiple inputs", async () => {
    const path = "/path/to/board";
    const inputs = { text: "bar", number: 42 };
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => multipleInputsBoard as GraphDescriptor,
    });
    assertResult(result, { type: "input" });
  });

  test("can finish a board with multiple inputs", async () => {
    await scriptedRun(multipleInputsBoard as GraphDescriptor, [
      { expected: { type: "input" } },
      { inputs: { text1: "foo" }, expected: { type: "input" } },
      {
        inputs: { text2: "bar" },
        expected: {
          type: "output",
          outputs: {
            "text-one": "foo",
            "text-two": "bar",
          },
        },
      },
      { expected: { type: "end" } },
    ]);
  });

  test("can finish a board with multiple outputs", async () => {
    await scriptedRun(manyOutputsBoard as GraphDescriptor, [
      { expected: { type: "input" } },
      {
        inputs: { start: "foo" },
        expected: { type: "output", outputs: { one: "foo" } },
      },
      {
        expected: {
          type: "output",
          outputs: {
            two: "foo",
          },
        },
      },
      { expected: { type: "end" } },
    ]);
  });

  test("can finish a board with bubbling inputs", async () => {
    await scriptedRun(invokeWithBubblingInput as GraphDescriptor, [
      { expected: { type: "input" } },
      { inputs: { name: "Bob" }, expected: { type: "input" } },
      {
        inputs: { location: "New York" },
        expected: {
          type: "output",
          outputs: {
            greeting: "Hello, Bob from New York!",
          },
        },
      },
      { expected: { type: "end" } },
    ]);
  });
});
