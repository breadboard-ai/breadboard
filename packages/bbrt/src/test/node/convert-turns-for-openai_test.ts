/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { suite, test } from "node:test";
import type { OpenAIMessage } from "../../drivers/openai-types.js";
import { convertTurnsForOpenAi } from "../../drivers/openai.js";
import { ReactiveTurnState } from "../../state/turn.js";

suite("convertTurnsForOpenAi", () => {
  test("simple exchange with function calls", () => {
    const turns: ReactiveTurnState[] = [
      new ReactiveTurnState({
        status: "done",
        role: "user",
        chunks: [
          {
            kind: "text",
            timestamp: 1000,
            text: "Hello",
          },
        ],
      }),
      new ReactiveTurnState({
        status: "done",
        role: "model",
        chunks: [
          {
            kind: "text",
            timestamp: 1001,
            text: "Hello, ",
          },
          {
            kind: "text",
            timestamp: 1001,
            text: "how are you?",
          },
          {
            kind: "function-call",
            timestamp: 1001,
            call: {
              callId: "123",
              functionId: "fake1",
              args: { foo: "bar" },
              response: {
                status: "success",
                result: { baz: "qux" },
                artifacts: [],
              },
            },
          },
          {
            kind: "function-call",
            timestamp: 1001,
            call: {
              callId: "456",
              functionId: "fake2",
              args: { foo: "bar" },
              response: {
                status: "error",
                error: { message: "Oops!" },
              },
            },
          },
        ],
      }),
      new ReactiveTurnState({
        status: "done",
        role: "model",
        chunks: [
          {
            kind: "text",
            timestamp: 1000,
            text: "Looks like some cool stuff happened!",
          },
        ],
      }),
      new ReactiveTurnState({
        status: "done",
        role: "user",
        chunks: [
          {
            kind: "text",
            timestamp: 1000,
            text: "Cool, thanks.",
          },
        ],
      }),
    ];
    const expected: OpenAIMessage[] = [
      {
        role: "user",
        content: "Hello",
      },
      {
        role: "assistant",
        content: "Hello, how are you?",
        tool_calls: [
          {
            type: "function",
            id: "123",
            index: undefined as unknown as number,
            function: {
              name: "fake1",
              arguments: JSON.stringify({ foo: "bar" }),
            },
          },
          {
            type: "function",
            id: "456",
            index: undefined as unknown as number,
            function: {
              name: "fake2",
              arguments: JSON.stringify({ foo: "bar" }),
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "123",
        content: JSON.stringify({ baz: "qux" }),
      },
      {
        role: "tool",
        tool_call_id: "456",
        content: JSON.stringify({ error: "Oops!" }),
      },
      {
        role: "assistant",
        content: "Looks like some cool stuff happened!",
      },
      {
        role: "user",
        content: "Cool, thanks.",
      },
    ];
    const actual = convertTurnsForOpenAi(turns);
    assert.deepEqual(actual, { ok: true, value: expected });
  });
});
