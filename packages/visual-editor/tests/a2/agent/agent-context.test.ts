/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { AgentContext } from "../../../src/a2/agent/agent-context.js";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

suite("AgentContext - getEventsFromRunState", () => {
  test("correctly reconstructs AgentEvents from a RunState", () => {
    const context = new AgentContext({
      shell: {} as unknown as OpalShellHostProtocol,
      fetchWithCreds: () => {
        throw new Error(`fetchWithCreds not implemented`);
      },
    });

    const runId = "test-run-id";
    const objective = { parts: [{ text: "Build a beautiful UI" }] };
    const run = context.createRun(runId, objective);

    // Turn 1: Model thoughts and function calls
    run.contents.push({
      role: "model",
      parts: [
        { thought: true, text: "I will call the search tool first." },
        {
          functionCall: {
            name: "search_tool",
            args: { query: "modern UI trends" },
          },
        },
      ],
    });

    // Turn 2: User/System tool response
    run.contents.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "search_tool",
            response: { results: "vibrant colors, glassmorphism" },
          },
        },
      ],
    });

    // Turn 3: Model final answer
    run.contents.push({
      role: "model",
      parts: [{ text: "Found trends: glassmorphism, vibrant colors." }],
    });

    run.status = "completed";

    const allEvents = context.getAllRunsAsEvents();
    assert.strictEqual(allEvents.length, 1);

    const events = allEvents[0];

    // Assert the sequence of events
    assert.deepStrictEqual(events[0], {
      start: { objective },
    });

    assert.deepStrictEqual(events[1], {
      thought: { text: "I will call the search tool first." },
    });

    assert.deepStrictEqual(events[2], {
      functionCall: {
        callId: "search_tool",
        name: "search_tool",
        args: { query: "modern UI trends" },
      },
    });

    // The overall model content event for Turn 1
    assert.deepStrictEqual(events[3], {
      content: {
        content: {
          role: "model",
          parts: [
            { thought: true, text: "I will call the search tool first." },
            {
              functionCall: {
                name: "search_tool",
                args: { query: "modern UI trends" },
              },
            },
          ],
        },
      },
    });

    // Turn 2 tool result
    assert.deepStrictEqual(events[4], {
      functionResult: {
        callId: "search_tool",
        content: {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "search_tool",
                response: { results: "vibrant colors, glassmorphism" },
              },
            },
          ],
        },
      },
    });

    // Turn 3 final answer
    assert.deepStrictEqual(events[5], {
      content: {
        content: {
          role: "model",
          parts: [{ text: "Found trends: glassmorphism, vibrant colors." }],
        },
      },
    });

    // Final complete event
    assert.deepStrictEqual(events[6], {
      complete: {
        result: {
          success: true,
          href: "",
          outcomes: {
            role: "model",
            parts: [{ text: "Found trends: glassmorphism, vibrant colors." }],
          },
        },
      },
    });
  });
});
