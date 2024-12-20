/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { suite, test } from "node:test";
import type { GeminiContent } from "../../drivers/gemini-types.js";
import { convertTurnsForGemini } from "../../drivers/gemini.js";
import { ReactiveTurnState } from "../../state/turn.js";

suite("convertTurnsForGemini", () => {
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
    const expected: GeminiContent[] = [
      {
        role: "user",
        parts: [{ text: "Hello" }],
      },
      {
        role: "model",
        parts: [
          { text: "Hello, how are you?" },
          { functionCall: { name: "fake1", args: { foo: "bar" } } },
          { functionCall: { name: "fake2", args: { foo: "bar" } } },
        ],
      },
      {
        role: "user",
        parts: [
          { functionResponse: { name: "fake1", response: { baz: "qux" } } },
          { functionResponse: { name: "fake2", response: { error: "Oops!" } } },
        ],
      },
      {
        role: "model",
        parts: [{ text: "Looks like some cool stuff happened!" }],
      },
      {
        role: "user",
        parts: [{ text: "Cool, thanks." }],
      },
    ];
    const actual = convertTurnsForGemini(turns);
    assert.deepEqual(actual, { ok: true, value: expected });
  });
});
