/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  OutputValues,
  ReanimationState,
  RemoteMessage,
  RunDiagnosticsLevel,
} from "@breadboard-ai/types";
import { deepStrictEqual, fail } from "assert";
import test, { describe } from "node:test";
import invokeWithBubblingInput from "../../../../test-data/boards/invoke-board-with-bubbling-input.bgl.json" with { type: "json" };
import multipleInputsBoard from "../../../../test-data/boards/many-inputs.bgl.json" with { type: "json" };
import manyOutputsBoard from "../../../../test-data/boards/many-outputs.bgl.json" with { type: "json" };
import simpleBoard from "../../../../test-data/boards/simple.bgl.json" with { type: "json" };
import type { RunBoardStateStore } from "../../types.js";
import { runBoard } from "./run-board.js";

const assertResults = (
  results: RemoteMessage[],
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
    switch (type) {
      case "output": {
        deepStrictEqual(
          data.outputs,
          expected.outputs,
          `Expected outputs to match at index ${index}`
        );
        break;
      }
      case "edge": {
        const [, data] = result;
        const { from, to } = data;
        if (expected.from) {
          deepStrictEqual(
            from,
            expected.from,
            `Expected from "${JSON.stringify(from)}" to match "${JSON.stringify(expected.from)}" at index ${index}`
          );
        }
        if (expected.to) {
          deepStrictEqual(
            to,
            expected.to,
            `Expected to "${JSON.stringify(to)}" to match "${JSON.stringify(expected.to)}" at index ${index}`
          );
        }
        break;
      }
      case "graphstart":
      case "graphend":
      case "nodestart":
      case "nodeend": {
        const [, data] = result;
        deepStrictEqual(
          data.path,
          expected.path,
          `Expected path "${JSON.stringify(data.path)}" to match "${JSON.stringify(expected.path)}" at index ${index}`
        );
        break;
      }
    }
  }
};

const getNext = (result?: RemoteMessage) => {
  if (!result) {
    fail("No result provided.");
  }
  const [type, data, next] = result;
  if (type === "error") {
    fail(data.error as string);
  }
  if (type === "input") {
    return next;
  }
  if (type === "output") {
    return undefined;
  }
  if (type === "end") {
    return undefined;
  }
  fail(`Unexpected state type: ${type}`);
};

type ExpectedResult = {
  type: string;
  outputs?: OutputValues;
  path?: number[];
  from?: number[];
  to?: number[];
};

type RunScriptEntry = {
  inputs?: Record<string, any>;
  expected: ExpectedResult[];
};

const runStateStore: RunBoardStateStore = {
  async loadReanimationState(user: string, ticket: string) {
    const state = JSON.parse(ticket) as ReanimationState;
    if (!state.states) {
      return undefined;
    }
    return state;
  },
  async saveReanimationState(user: string, state: any) {
    return JSON.stringify(state);
  },
};

const scriptedRun = async (
  board: GraphDescriptor,
  script: RunScriptEntry[],
  diagnostics: RunDiagnosticsLevel = false
) => {
  let next;
  const path = "/boards/user/name";
  for (const [index, { inputs, expected }] of script.entries()) {
    const results: RemoteMessage[] = [];
    const writer = new WritableStream<RemoteMessage>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();

    await runBoard({
      serverUrl: "https://example.com",
      user: "test",
      path,
      url: `https://example.com${path}`,
      loader: async () => board,
      inputs,
      next,
      writer,
      runStateStore,
      diagnostics,
      kitOverrides: [
        {
          url: "",
          handlers: {
            // template-kit has been deleted, so this is a trivial test-only
            // implementation of promptTemplate to avoid having to design some
            // new test cases.
            promptTemplate: async (inputs: InputValues) => {
              const { template, ...values } = inputs as {
                template: string;
                [K: string]: string;
              };
              let prompt = template;
              for (const [key, value] of Object.entries(values)) {
                prompt = prompt.replaceAll(`{{${key}}}`, value);
              }
              return { prompt, text: prompt };
            },
          },
        },
      ],
    });
    assertResults(results, expected, index);
    next = getNext(results[results.length - 1]);
  }
};

describe("Board Server Runs Boards", () => {
  test("can start a simple board", async () => {
    const path = "/boards/user/name";
    const results: RemoteMessage[] = [];
    const writer = new WritableStream<RemoteMessage>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();
    await runBoard({
      serverUrl: "https://example.com",
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
    const path = "/boards/user/name";
    const inputs = { text: "bar" };
    const results: RemoteMessage[] = [];
    const writer = new WritableStream<RemoteMessage>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();
    await runBoard({
      serverUrl: "https://example.com",
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
    const path = "/boards/user/name";
    const inputs = { text: "bar", number: 42 };
    const results: RemoteMessage[] = [];
    const writer = new WritableStream<RemoteMessage>({
      async write(chunk) {
        results.push(chunk);
      },
    }).getWriter();
    await runBoard({
      serverUrl: "https://example.com",
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

  test("can finish a board with bubbling inputs with diagnostics", async () => {
    await scriptedRun(
      invokeWithBubblingInput as GraphDescriptor,
      [
        {
          expected: [
            { type: "graphstart", path: [] },
            { type: "edge", from: undefined, to: [1] },
            { type: "nodestart", path: [1] },
            { type: "input" },
          ],
        },
        {
          inputs: { name: "Bob" },
          expected: [
            { type: "nodeend", path: [1] },
            { type: "edge", from: [1], to: [2] },
            { type: "nodestart", path: [2] },
            { type: "graphstart", path: [2] },
            { type: "edge", from: undefined, to: [2, 1] },
            { type: "nodestart", path: [2, 1] },
            { type: "input" },
          ],
        },
        {
          inputs: { location: "New York" },
          expected: [
            { type: "nodeend", path: [2, 1] },
            { type: "edge", from: [2, 1], to: [2, 2] },
            { type: "nodestart", path: [2, 2] },
            { type: "nodeend", path: [2, 2] },
            { type: "edge", from: [2, 1], to: [2, 3] },
            { type: "edge", from: [2, 2], to: [2, 4] },
            { type: "nodestart", path: [2, 4] },
            { type: "nodeend", path: [2, 4] },
            { type: "graphend", path: [2] },
            { type: "nodeend", path: [2] },
            { type: "edge", from: [2], to: [3] },
            { type: "nodestart", path: [3] },
            { type: "nodeend", path: [3] },
            { type: "edge", from: [3], to: [4] },
            { type: "nodestart", path: [4] },
            {
              type: "output",
              outputs: {
                greeting: 'Greeting is: "Hello, Bob from New York!"',
              },
            },
            { type: "nodeend", path: [4] },
            { type: "graphend", path: [] },
            { type: "end" },
          ],
        },
      ],
      true
    );
  });

  test('can finish a board with bubbling inputs with "top" diagnostics', async () => {
    await scriptedRun(
      invokeWithBubblingInput as GraphDescriptor,
      [
        {
          expected: [
            { type: "graphstart", path: [] },
            { type: "nodestart", path: [1] },
            { type: "input" },
          ],
        },
        {
          inputs: { name: "Bob" },
          expected: [
            { type: "nodeend", path: [1] },
            { type: "nodestart", path: [2] },
            { type: "input" },
          ],
        },
        {
          inputs: { location: "New York" },
          expected: [
            { type: "nodeend", path: [2] },
            { type: "nodestart", path: [3] },
            { type: "nodeend", path: [3] },
            { type: "nodestart", path: [4] },
            {
              type: "output",
              outputs: {
                greeting: 'Greeting is: "Hello, Bob from New York!"',
              },
            },
            { type: "nodeend", path: [4] },
            { type: "graphend", path: [] },
            { type: "end" },
          ],
        },
      ],
      "top"
    );
  });
});
