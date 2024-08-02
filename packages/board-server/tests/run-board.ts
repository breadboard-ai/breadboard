/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { deepStrictEqual, fail } from "assert";
import { runBoard } from "../src/server/boards/utils/run-board.js";
import type {
  GraphDescriptor,
  Kit,
  OutputValues,
  ReanimationState,
} from "@google-labs/breadboard";

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

const assertResults = (
  results: RunBoardResult[],
  expectedResults: ExpectedResult[],
  index = 0
) => {
  if (results.length !== expectedResults.length) {
    fail(
      `Expected ${expectedResults.length} results, but got ${results.length} at index ${index}`
    );
  }
  for (const [i, result] of results.entries()) {
    const expected = expectedResults[i]!;
    const [type, data] = result;
    if (type === "error") {
      fail(`Unexpected error: ${data}`);
    }
    deepStrictEqual(
      type,
      expected.type,
      `Expected state type to be ${expected.type} at index ${index}`
    );
    if (type === "output") {
      deepStrictEqual(
        data,
        expected.outputs,
        `Expected outputs to match at index ${index}`
      );
    }
  }
};

const getNext = (result?: RunBoardResult) => {
  if (!result) {
    fail("No result provided.");
  }
  const [type, data] = result;
  if (type === "error") {
    fail(data);
  }
  if (type === "input") {
    return data.next;
  }
  if (type === "output") {
    return undefined;
  }
  fail("Unexpected state type.");
};

type ExpectedResult = {
  type: string;
  outputs?: OutputValues;
};

type RunScriptEntry = {
  inputs?: Record<string, any>;
  expected: ExpectedResult[];
};

const runStateStore = {
  async loadReanimationState(user: string, ticket: string) {
    return JSON.parse(ticket) as ReanimationState;
  },
  async saveReanimationState(user: string, state: any) {
    return JSON.stringify(state);
  },
};

const scriptedRun = async (
  board: GraphDescriptor,
  script: RunScriptEntry[]
) => {
  let next;
  const path = "/path/to/board";
  for (const [index, { inputs, expected }] of script.entries()) {
    const results: RunBoardResult[] = [];
    const writer = new WritableStream<RunBoardResult>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();

    await runBoard({
      user: "test",
      path,
      url: `https://example.com${path}`,
      loader: async () => board,
      inputs,
      next,
      writer,
      runStateStore,
    });
    assertResults(results, expected, index);
    next = getNext(results[results.length - 1]);
  }
};

describe("Board Server Runs Boards", () => {
  test("can start a simple board", async () => {
    const path = "/path/to/board";
    const results: RunBoardResult[] = [];
    const writer = new WritableStream<RunBoardResult>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();
    await runBoard({
      user: "test",
      path,
      url: `https://example.com${path}`,
      loader: async () => simpleBoard,
      writer,
      runStateStore,
    });
    assertResults(results, [{ type: "input" }]);
  });

  test("can finish a simple board", async () => {
    await scriptedRun(simpleBoard, [
      { expected: [{ type: "input" }] },
      {
        inputs: { text: "foo" },
        expected: [{ type: "output", outputs: { text: "foo" } }],
      },
    ]);
  });

  test("can start a simple board with inputs", async () => {
    const path = "/path/to/board";
    const inputs = { text: "bar" };
    const results: RunBoardResult[] = [];
    const writer = new WritableStream<RunBoardResult>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();
    await runBoard({
      user: "test",
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => simpleBoard,
      writer,
      runStateStore,
    });
    assertResults(results, [
      {
        type: "output",
        outputs: {
          text: "bar",
        },
      },
    ]);
  });

  test("can start a board with multiple inputs", async () => {
    const path = "/path/to/board";
    const inputs = { text: "bar", number: 42 };
    const results: RunBoardResult[] = [];
    const writer = new WritableStream<RunBoardResult>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();
    await runBoard({
      user: "test",
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => multipleInputsBoard as GraphDescriptor,
      writer,
      runStateStore,
    });
    assertResults(results, [{ type: "input" }]);
  });

  test("can finish a board with multiple inputs", async () => {
    await scriptedRun(multipleInputsBoard as GraphDescriptor, [
      { expected: [{ type: "input" }] },
      { inputs: { text1: "foo" }, expected: [{ type: "input" }] },
      {
        inputs: { text2: "bar" },
        expected: [
          {
            type: "output",
            outputs: {
              "text-one": "foo",
              "text-two": "bar",
            },
          },
        ],
      },
    ]);
  });

  test("can finish a board with multiple outputs", async () => {
    await scriptedRun(manyOutputsBoard as GraphDescriptor, [
      { expected: [{ type: "input" }] },
      {
        inputs: { start: "foo" },
        expected: [
          {
            type: "output",
            outputs: { one: "foo" },
          },
          {
            type: "output",
            outputs: { two: "foo" },
          },
        ],
      },
    ]);
  });

  test("can finish a board with bubbling inputs", async () => {
    await scriptedRun(invokeWithBubblingInput as GraphDescriptor, [
      { expected: [{ type: "input" }] },
      { inputs: { name: "Bob" }, expected: [{ type: "input" }] },
      {
        inputs: { location: "New York" },
        expected: [
          {
            type: "output",
            outputs: {
              greeting: 'Greeting is: "Hello, Bob from New York!"',
            },
          },
        ],
      },
    ]);
  });
});
