/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { suite, test } from "node:test";
import type { BBRTDriver } from "../../drivers/driver-interface.js";
import { Conversation } from "../../llm/conversation.js";
import { ReactiveSessionBriefState } from "../../state/session-brief.js";
import { ReactiveSessionEventState } from "../../state/session-event.js";
import { ReactiveSessionState } from "../../state/session.js";
import { type BBRTTool } from "../../tools/tool-types.js";
import { type Clock } from "../../util/clock-type.js";
import { FakeClock } from "./util/fake-clock.js";
import { FakeDriver } from "./util/fake-driver.js";
import { FakeTool } from "./util/fake-tool.js";

suite("SesssionManager", async () => {
  function makeManager(opts?: {
    state?: ReactiveSessionState;
    drivers?: Record<string, BBRTDriver>;
    tools?: Record<string, BBRTTool>;
    clock?: Clock;
  }) {
    let nextId = 1;
    return new Conversation({
      state:
        opts?.state ??
        new ReactiveSessionState(
          {
            id: "session0",
            events: [
              new ReactiveSessionEventState({
                timestamp: 1000,
                id: "fake-uuid",
                detail: {
                  kind: "set-driver",
                  driverId: "fake",
                },
              }),
            ],
          },
          new ReactiveSessionBriefState({
            id: "session0",
            title: "Session Title",
          })
        ),
      drivers: new Map(Object.entries(opts?.drivers ?? {})),
      availableToolsPromise: Promise.resolve(
        new Map(Object.entries(opts?.tools ?? {}))
      ),
      clock: opts?.clock ?? new FakeClock(),
      idGenerator: () => `fake-uuid-${nextId++}`,
    });
  }

  test("is initially ready", () => {
    const manager = makeManager();
    assert.equal(manager.status, "ready");
  });

  test("no matching drivers returns sync error", () => {
    const manager = makeManager({ drivers: {} });
    assert.equal(manager.send("hello").ok, false);
    assert.equal(manager.status, "ready");
  });

  // TODO(aomarks) Something very bad is happening with data getting shared
  // across tests.

  // test("basic exchange", async () => {
  //   using driver = new FakeDriver();
  //   const state = new ReactiveSessionState(
  //     {
  //       id: "session0",
  //       events: [
  //         new ReactiveSessionEventState({
  //           timestamp: 1000,
  //           id: "fake-uuid",
  //           detail: {
  //             kind: "set-driver",
  //             driverId: driver.id,
  //           },
  //         }),
  //       ],
  //     },
  //     new ReactiveSessionBriefState({
  //       id: "session0",
  //       title: "Session 0 Title",
  //     })
  //   );
  //   const manager = makeManager({
  //     state,
  //     drivers: { fake: driver },
  //   });
  //   assert.equal(manager.status, "ready");
  //   assert.equal(state.events.length, 1);

  //   const turn = manager.send("Hello, I'm a person.");
  //   assert.equal(turn.ok, true, String(turn.error));
  //   assert.equal(manager.status, "busy");
  //   assert.deepEqual(state.data, {
  //     id: "session0",
  //     events: [
  //       {
  //         detail: {
  //           driverId: "fake",
  //           kind: "set-driver",
  //         },
  //         id: "fake-uuid",
  //         timestamp: 1000,
  //       },
  //       {
  //         id: "fake-uuid-1",
  //         timestamp: 1000,
  //         detail: {
  //           kind: "turn",
  //           turn: {
  //             role: "user",
  //             status: "done",
  //             chunks: [
  //               {
  //                 timestamp: 1000,
  //                 kind: "text",
  //                 text: "Hello, I'm a person.",
  //               },
  //             ],
  //           },
  //         },
  //       },
  //     ],
  //   });

  //   await driver.handleNextRequest(() => [
  //     {
  //       timestamp: 1000,
  //       kind: "text",
  //       text: "Hello, ",
  //     },
  //     {
  //       timestamp: 1000,
  //       kind: "text",
  //       text: "I'm a computer.",
  //     },
  //   ]);

  //   await turn.value.done;
  //   assert.equal(state.turns[0]!.partialText, "Hello, I'm a person.");
  //   assert.equal(state.turns[1]!.partialText, "Hello, I'm a computer.");
  //   assert.deepEqual(state.data, {
  //     id: "session0",
  //     events: [
  //       {
  //         detail: {
  //           driverId: "fake",
  //           kind: "set-driver",
  //         },
  //         id: "fake-uuid",
  //         timestamp: 1000,
  //       },
  //       {
  //         id: "fake-uuid-1",
  //         timestamp: 1000,
  //         detail: {
  //           kind: "turn",
  //           turn: {
  //             role: "user",
  //             status: "done",
  //             chunks: [
  //               {
  //                 timestamp: 1000,
  //                 kind: "text",
  //                 text: "Hello, I'm a person.",
  //               },
  //             ],
  //           },
  //         },
  //       },
  //       {
  //         id: "fake-uuid-2",
  //         timestamp: 1000,
  //         detail: {
  //           kind: "turn",
  //           turn: {
  //             role: "model",
  //             status: "done",
  //             chunks: [
  //               {
  //                 timestamp: 1000,
  //                 kind: "text",
  //                 text: "Hello, ",
  //               },
  //               {
  //                 timestamp: 1000,
  //                 kind: "text",
  //                 text: "I'm a computer.",
  //               },
  //             ],
  //           },
  //         },
  //       },
  //     ],
  //   });
  // });

  test("function calls", async () => {
    using driver = new FakeDriver();
    using tool = new FakeTool("makeCatPicture");

    const state = new ReactiveSessionState(
      {
        id: "session0",
        events: [
          {
            detail: {
              driverId: "fake",
              kind: "set-driver",
            },
            id: "fake-uuid",
            timestamp: 1000,
          },
          {
            detail: {
              toolIds: [tool.metadata.id],
              kind: "set-active-tool-ids",
            },
            id: "fake-uuid",
            timestamp: 1000,
          },
        ],
      },
      new ReactiveSessionBriefState({
        id: "session0",
        title: "Session 0 Title",
      })
    );
    const manager = makeManager({
      state,
      drivers: { fake: driver },
      tools: { makeCatPicture: tool },
    });
    assert.equal(manager.status, "ready");
    assert.deepEqual(state.data, {
      id: "session0",
      events: [
        {
          detail: {
            driverId: "fake",
            kind: "set-driver",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          detail: {
            toolIds: ["makeCatPicture"],
            kind: "set-active-tool-ids",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
      ],
    });

    const turn = manager.send("Please generate a cat picture.");
    assert.equal(turn.ok, true, String(turn.error));
    assert.equal(manager.status, "busy");
    assert.deepEqual(state.data, {
      id: "session0",
      events: [
        {
          detail: {
            driverId: "fake",
            kind: "set-driver",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          detail: {
            toolIds: ["makeCatPicture"],
            kind: "set-active-tool-ids",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          id: "fake-uuid-1",
          timestamp: 1000,
          detail: {
            kind: "turn",
            turn: {
              role: "user",
              status: "done",
              chunks: [
                {
                  timestamp: 1000,
                  kind: "text",
                  text: "Please generate a cat picture.",
                },
              ],
            },
          },
        },
      ],
    });

    await driver.handleNextRequest(() => [
      {
        timestamp: 1000,
        kind: "text",
        text: "Sure, cat incoming.",
      },
      {
        timestamp: 1000,
        kind: "function-call",
        call: {
          functionId: "makeCatPicture",
          callId: "fake-uuid-3",
          args: { cuteness: 9.0 },
          response: { status: "unstarted" },
        },
      },
    ]);

    assert.deepEqual(state.data, {
      id: "session0",
      events: [
        {
          detail: {
            driverId: "fake",
            kind: "set-driver",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          detail: {
            toolIds: ["makeCatPicture"],
            kind: "set-active-tool-ids",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          id: "fake-uuid-1",
          timestamp: 1000,
          detail: {
            kind: "turn",
            turn: {
              role: "user",
              status: "done",
              chunks: [
                {
                  timestamp: 1000,
                  kind: "text",
                  text: "Please generate a cat picture.",
                },
              ],
            },
          },
        },
        {
          detail: {
            kind: "turn",
            turn: {
              chunks: [
                {
                  kind: "text",
                  text: "Sure, cat incoming.",
                  timestamp: 1000,
                },
                {
                  call: {
                    args: {
                      cuteness: 9,
                    },
                    callId: "fake-uuid-3",
                    functionId: "makeCatPicture",
                    response: {
                      status: "unstarted",
                    },
                  },
                  kind: "function-call",
                  timestamp: 1000,
                },
              ],
              role: "model",
              status: "pending",
            },
          },
          id: "fake-uuid-2",
          timestamp: 1000,
        },
      ],
    });

    await tool.handleNextRequest(async (args) => {
      assert.deepEqual(args, { cuteness: 9.0 });
      return { url: "https://example.com/cat.jpg" };
    });

    await driver.handleNextRequest(() => [
      {
        timestamp: 1000,
        kind: "text",
        text: "I hope you like the cat!",
      },
    ]);
    await turn.value.done;

    assert.deepEqual(state.data, {
      events: [
        {
          detail: {
            driverId: "fake",
            kind: "set-driver",
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          detail: {
            kind: "set-active-tool-ids",
            toolIds: ["makeCatPicture"],
          },
          id: "fake-uuid",
          timestamp: 1000,
        },
        {
          id: "fake-uuid-1",
          timestamp: 1000,
          detail: {
            kind: "turn",
            turn: {
              role: "user",
              status: "done",
              chunks: [
                {
                  timestamp: 1000,
                  kind: "text",
                  text: "Please generate a cat picture.",
                },
              ],
            },
          },
        },
        {
          id: "fake-uuid-2",
          timestamp: 1000,
          detail: {
            kind: "turn",
            turn: {
              chunks: [
                {
                  timestamp: 1000,
                  kind: "text",
                  text: "Sure, cat incoming.",
                },
                {
                  kind: "function-call",
                  timestamp: 1000,
                  call: {
                    args: {
                      cuteness: 9,
                    },
                    callId: "fake-uuid-3",
                    functionId: "makeCatPicture",
                    response: {
                      status: "success",
                      result: {
                        url: "https://example.com/cat.jpg",
                      },
                      artifacts: [],
                    },
                  },
                },
              ],
              role: "model",
              status: "done",
            },
          },
        },
        {
          id: "fake-uuid-3",
          timestamp: 1000,
          detail: {
            kind: "turn",
            turn: {
              role: "model",
              status: "done",
              chunks: [
                {
                  timestamp: 1000,
                  kind: "text",
                  text: "I hope you like the cat!",
                },
              ],
            },
          },
        },
      ],
      id: "session0",
    });
  });
});
