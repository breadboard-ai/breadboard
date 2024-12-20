/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { ReactiveAppState, type AppState } from "../../state/app.js";
import { ReactiveFunctionCallState } from "../../state/function-call.js";
import { ReactiveSessionBriefState } from "../../state/session-brief.js";
import {
  ReactiveSessionEventState,
  type SessionEventState,
} from "../../state/session-event.js";
import {
  ReactiveSessionState,
  type SessionState,
} from "../../state/session.js";
import { ReactiveTurnState, type TurnState } from "../../state/turn.js";

suite("state", () => {
  suite("App", () => {
    test("JSON round-trip", () => {
      const state = (): AppState => ({
        sessions: {
          id1: {
            id: "id1",
            title: "title1",
          },
          id2: {
            id: "id2",
            title: "title2",
          },
        },
      });
      const reactive = new ReactiveAppState(state());
      assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
    });
  });

  suite("Session", () => {
    test("JSON round-trip", () => {
      const state = (): SessionState => ({
        id: "id1",
        events: [
          {
            id: "event1",
            timestamp: 123,
            detail: {
              kind: "set-driver",
              driverId: "driver1",
            },
          },
        ],
      });
      const reactive = new ReactiveSessionState(
        state(),
        new ReactiveSessionBriefState({
          id: "id1",
          title: "title1",
        })
      );
      assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
    });

    suite("utilities", () => {
      test("title", () => {
        const brief = new ReactiveSessionBriefState({
          id: "id1",
          title: "title1",
        });
        const session = new ReactiveSessionState(
          { id: "id1", events: [] },
          brief
        );
        assert.strictEqual(session.title, "title1");
        session.title = "title2";
        assert.strictEqual(brief.title, "title2");
        assert.strictEqual(session.title, "title2");
      });

      test("latestDriver", () => {
        const state = (): SessionState => ({
          id: "id1",
          events: [
            {
              id: "event1",
              timestamp: 123,
              detail: {
                kind: "set-driver",
                driverId: "driver1",
              },
            },
            {
              id: "event2",
              timestamp: 124,
              detail: {
                kind: "set-system-prompt",
                systemPrompt: "prompt1",
              },
            },
            {
              id: "event3",
              timestamp: 125,
              detail: {
                kind: "set-driver",
                driverId: "driver2",
              },
            },
          ],
        });
        const reactive = new ReactiveSessionState(
          state(),
          new ReactiveSessionBriefState({
            id: "id1",
            title: "title1",
          })
        );
        assert.strictEqual(reactive.driverId, "driver2");

        reactive.events.push(
          new ReactiveSessionEventState({
            id: "event4",
            timestamp: 126,
            detail: { kind: "set-driver", driverId: "driver3" },
          })
        );
        assert.strictEqual(reactive.driverId, "driver3");
      });

      test("latestSystemPrompt", () => {
        const state = (): SessionState => ({
          id: "id1",
          events: [
            {
              id: "event1",
              timestamp: 123,
              detail: {
                kind: "set-system-prompt",
                systemPrompt: "prompt1",
              },
            },
            {
              id: "event2",
              timestamp: 124,
              detail: {
                kind: "set-driver",
                driverId: "driver1",
              },
            },
            {
              id: "event3",
              timestamp: 125,
              detail: {
                kind: "set-system-prompt",
                systemPrompt: "prompt2",
              },
            },
          ],
        });
        const reactive = new ReactiveSessionState(
          state(),
          new ReactiveSessionBriefState({
            id: "id1",
            title: "title1",
          })
        );
        assert.strictEqual(reactive.systemPrompt, "prompt2");

        reactive.events.push(
          new ReactiveSessionEventState({
            id: "event4",
            timestamp: 126,
            detail: { kind: "set-system-prompt", systemPrompt: "prompt3" },
          })
        );
        assert.strictEqual(reactive.systemPrompt, "prompt3");
      });
    });
  });

  suite("SessionEvent", () => {
    suite("Turn", () => {
      test("JSON round-trip", () => {
        const state = (): SessionEventState => ({
          id: "event1",
          timestamp: 123,
          detail: {
            kind: "turn",
            turn: {
              role: "user",
              status: "done",
              chunks: [
                {
                  timestamp: 124,
                  kind: "text",
                  text: "text1",
                },
              ],
            },
          },
        });
        const reactive = new ReactiveSessionEventState(state());
        assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
      });
    });

    suite("SetDriver", () => {
      test("JSON round-trip", () => {
        const state = (): SessionEventState => ({
          id: "event1",
          timestamp: 123,
          detail: {
            kind: "set-driver",
            driverId: "driver1",
          },
        });
        const reactive = new ReactiveSessionEventState(state());
        assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
      });
    });

    suite("SetSystemPrompt", () => {
      test("JSON round-trip", () => {
        const state = (): SessionEventState => ({
          id: "event1",
          timestamp: 123,
          detail: {
            kind: "set-system-prompt",
            systemPrompt: "systemPrompt1",
          },
        });
        const reactive = new ReactiveSessionEventState(state());
        assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
      });
    });

    suite("SetTool", () => {
      test("JSON round-trip", () => {
        const state = (): SessionEventState => ({
          id: "event1",
          timestamp: 123,
          detail: {
            kind: "set-active-tool-ids",
            toolIds: ["tool1", "tool2"],
          },
        });
        const reactive = new ReactiveSessionEventState(state());
        assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
      });
    });
  });
});

suite("Turn", () => {
  test("JSON round-trip", () => {
    const state = (): TurnState => ({
      role: "model",
      status: "done",
      chunks: [
        {
          kind: "text",
          timestamp: 123,
          text: "I'm going to do something cool",
        },
        {
          kind: "function-call",
          timestamp: 124,
          call: {
            callId: "abc123",
            functionId: "somethingCool",
            args: {
              something: "cool",
            },
            response: {
              status: "success",
              result: {
                result: "cool",
              },
              artifacts: [],
            },
          },
        },
        {
          kind: "error",
          timestamp: 125,
          error: { message: "Oops" },
        },
        {
          kind: "finished",
          timestamp: 126,
        },
      ],
    });
    const reactive = new ReactiveTurnState(state());
    assert.deepEqual(JSON.parse(JSON.stringify(reactive.data)), state());
  });

  suite("utilities", () => {
    const state = (): TurnState => ({
      role: "model",
      status: "done",
      chunks: [
        {
          kind: "text",
          timestamp: 123,
          text: "I'm going to ",
        },
        {
          kind: "error",
          timestamp: 124,
          error: { message: "Oops!" },
        },
        {
          kind: "function-call",
          timestamp: 125,
          call: {
            callId: "abc123",
            functionId: "somethingCool",
            args: {
              something: "cool",
            },
            response: {
              status: "success",
              result: {
                result: "cool",
              },
              artifacts: [],
            },
          },
        },
        {
          kind: "text",
          timestamp: 126,
          text: "do something cool",
        },
        {
          kind: "finished",
          timestamp: 127,
        },
      ],
    });

    test("partialText", () => {
      const reactive = new ReactiveTurnState(state());
      assert.strictEqual(
        reactive.partialText,
        "I'm going to do something cool"
      );

      reactive.chunks.push({
        kind: "text",
        timestamp: 128,
        text: " right now!",
      });
      assert.strictEqual(
        reactive.partialText,
        "I'm going to do something cool right now!"
      );
    });

    test("partialFunctionCalls", () => {
      const reactive = new ReactiveTurnState(state());
      const calls1 = reactive.partialFunctionCalls;
      assert.strictEqual(calls1.length, 1);
      assert.strictEqual(calls1[0]!.functionId, "somethingCool");

      reactive.chunks.push({
        kind: "function-call",
        timestamp: 128,
        call: new ReactiveFunctionCallState({
          callId: "def456",
          functionId: "somethingElse",
          args: { something: "else" },
          response: {
            status: "unstarted",
          },
        }),
      });
      const calls2 = reactive.partialFunctionCalls;
      assert.strictEqual(calls2.length, 2);
      assert.strictEqual(calls1[0]!.functionId, "somethingCool");
      assert.strictEqual(calls1[1]!.functionId, "somethingElse");
    });

    test("partialErrors", () => {
      const reactive = new ReactiveTurnState(state());
      const errors1 = reactive.partialErrors;
      assert.strictEqual(errors1.length, 1);
      assert.strictEqual(errors1[0]!.error.message, "Oops!");

      reactive.chunks.push({
        kind: "error",
        timestamp: 128,
        error: { message: "Oh no :(" },
      });
      const errors2 = reactive.partialErrors;
      assert.strictEqual(errors2.length, 2);
      assert.strictEqual(errors2[0]!.error.message, "Oops!");
      assert.strictEqual(errors2[1]!.error.message, "Oh no :(");
    });
  });
});
