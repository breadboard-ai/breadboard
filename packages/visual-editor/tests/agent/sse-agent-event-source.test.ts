/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { mock, suite, test, beforeEach, afterEach } from "node:test";
import { SSEAgentEventSource } from "../../src/a2/agent/sse-agent-event-source.js";
import { AgentEventConsumer } from "../../src/a2/agent/agent-event-consumer.js";
import type { AgentEvent } from "../../src/a2/agent/agent-event.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an SSE-formatted ReadableStream from an array of events.
 * Wraps each event in the session SSE format:
 *   event: event\nid: N\ndata: <json>\n\n
 * Plus the start/done envelope events.
 */
function sessionSseStream(
  sessionId: string,
  events: AgentEvent[],
  startIndex = 0
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      // Session start envelope.
      controller.enqueue(
        encoder.encode(
          `event: start\ndata: ${JSON.stringify({ sessionId })}\n\n`
        )
      );
      // Agent events.
      for (let i = 0; i < events.length; i++) {
        controller.enqueue(
          encoder.encode(
            `event: event\nid: ${startIndex + i}\ndata: ${JSON.stringify(events[i])}\n\n`
          )
        );
      }
      // Session done envelope.
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
  });
}

/** Create a mock fetch Response with an SSE body. */
function sseResponse(body: ReadableStream): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body,
    headers: new Headers(),
  } as unknown as Response;
}

/** Create a mock JSON fetch Response. */
function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: null,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
  } as unknown as Response;
}

const SESSION_ID = "sess-test-123";
const TEST_CONFIG = { kind: "test", objective: { parts: [{ text: "hi" }] } };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("SSEAgentEventSource (session protocol)", () => {
  let fetchCalls: Array<{ url: string; init?: RequestInit }>;

  beforeEach(() => {
    setDOM();
    fetchCalls = [];
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  /**
   * Install a mock fetch that handles the session protocol:
   *   1. POST /sessions/new → { sessionId }
   *   2. GET /sessions/{id} → SSE stream
   */
  function installFetch(events: AgentEvent[]) {
    mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: urlStr, init });

        // POST /sessions/new → return session ID.
        if (urlStr.includes("/sessions/new") && init?.method === "POST") {
          return jsonResponse({ sessionId: SESSION_ID });
        }
        // GET /sessions/{id} → return SSE stream.
        if (urlStr.includes(`/sessions/${SESSION_ID}`)) {
          return sseResponse(sessionSseStream(SESSION_ID, events));
        }
        throw new Error(`Unexpected fetch: ${urlStr}`);
      }
    );
  }

  test("dispatches fire-and-forget events to consumer", async () => {
    const events: AgentEvent[] = [
      { thought: { text: "thinking" } },
      { finish: {} },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(`thought:${payload.text}`);
    });
    consumer.on("finish", () => {
      received.push("finish");
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0], "thought:thinking");
    assert.strictEqual(received[1], "finish");
    assert.strictEqual(source.sessionId, SESSION_ID);

    // Verify the two-call protocol.
    assert.strictEqual(fetchCalls.length, 2);

    // First call: POST /sessions/new.
    assert.ok(fetchCalls[0].url.includes("/sessions/new"));
    assert.strictEqual(fetchCalls[0].init?.method, "POST");

    // Second call: GET /sessions/{id}.
    assert.ok(fetchCalls[1].url.includes(`/sessions/${SESSION_ID}`));
    assert.strictEqual(fetchCalls[1].init?.method, undefined); // GET
  });

  test("suspend event triggers resume + reconnect", async () => {
    // Stream 1: events → suspend (stream closes).
    const stream1Events: AgentEvent[] = [
      { thought: { text: "thinking" } },
      {
        waitForInput: {
          requestId: "req-42",
          interactionId: "int-abc",
          prompt: { parts: [{ text: "What is your name?" }], role: "model" },
          inputType: "text",
        },
      },
    ];

    // Stream 2: resumed events → complete.
    const stream2Events: AgentEvent[] = [
      { thought: { text: "processing response" } },
      {
        complete: {
          result: { success: true, href: "/", outcomes: undefined },
        },
      } as unknown as AgentEvent,
    ];

    let streamCallCount = 0;
    mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: urlStr, init });

        // POST /sessions/new.
        if (urlStr.includes("/sessions/new") && init?.method === "POST") {
          return jsonResponse({ sessionId: SESSION_ID });
        }
        // POST /sessions/{id}:resume.
        if (urlStr.includes(":resume") && init?.method === "POST") {
          return jsonResponse({ ok: true });
        }
        // GET /sessions/{id} → SSE stream (first or second).
        if (urlStr.includes(`/sessions/${SESSION_ID}`)) {
          streamCallCount++;
          if (streamCallCount === 1) {
            return sseResponse(
              sessionSseStream(SESSION_ID, stream1Events)
            );
          }
          return sseResponse(
            sessionSseStream(SESSION_ID, stream2Events, 2)
          );
        }
        throw new Error(`Unexpected fetch: ${urlStr}`);
      }
    );

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(`thought:${payload.text}`);
    });
    consumer.on("complete", () => {
      received.push("complete");
    });
    consumer.on("waitForInput", () => {
      return Promise.resolve({
        input: { parts: [{ text: "Alice" }] },
      });
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    // Both streams' events should be dispatched.
    assert.deepStrictEqual(received, [
      "thought:thinking",
      "thought:processing response",
      "complete",
    ]);

    // Four fetch calls: create, stream1, resume, stream2.
    assert.strictEqual(fetchCalls.length, 4);

    // 1. POST /sessions/new.
    assert.ok(fetchCalls[0].url.includes("/sessions/new"));

    // 2. GET /sessions/{id} (first stream).
    assert.ok(fetchCalls[1].url.includes(`/sessions/${SESSION_ID}`));
    assert.ok(!fetchCalls[1].url.includes("after="));

    // 3. POST /sessions/{id}:resume.
    assert.ok(fetchCalls[2].url.includes(":resume"));
    const resumeBody = JSON.parse(fetchCalls[2].init?.body as string);
    assert.deepStrictEqual(resumeBody.response, {
      input: { parts: [{ text: "Alice" }] },
    });

    // 4. GET /sessions/{id}?after=1 (reconnect after suspend).
    assert.ok(fetchCalls[3].url.includes(`after=1`));
  });

  test("processes events between finish and complete", async () => {
    const events: AgentEvent[] = [
      { thought: { text: "before finish" } },
      { finish: {} },
      {
        complete: {
          result: {
            success: true,
            href: "/",
            outcomes: { parts: [{ text: "the outcome" }] },
          },
        },
      } as unknown as AgentEvent,
      { thought: { text: "after complete" } },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(`thought:${payload.text}`);
    });
    consumer.on("finish", () => {
      received.push("finish");
    });
    consumer.on("complete", () => {
      received.push("complete");
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.deepStrictEqual(received, [
      "thought:before finish",
      "finish",
      "complete",
    ]);
  });

  test("complete event carries AgentResult with outcomes", async () => {
    const outcomeContent = { parts: [{ text: "Why did the chicken..." }] };
    const events: AgentEvent[] = [
      { start: { objective: { parts: [{ text: "tell a joke" }] } } },
      { finish: {} },
      {
        complete: {
          result: {
            success: true,
            href: "/",
            outcomes: outcomeContent,
          },
        },
      } as unknown as AgentEvent,
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    let capturedResult: Record<string, unknown> | undefined;

    consumer.on("start", () => {});
    consumer.on("finish", () => {});
    consumer.on("complete", (payload) => {
      capturedResult = payload.result as unknown as Record<string, unknown>;
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.ok(capturedResult, "complete handler should have been called");
    assert.strictEqual(capturedResult.success, true);
    assert.deepStrictEqual(capturedResult.outcomes, outcomeContent);
  });

  test("gracefully handles stream ending after finish without complete", async () => {
    const events: AgentEvent[] = [
      { thought: { text: "working" } },
      { finish: {} },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(payload.text);
    });
    consumer.on("finish", () => {
      received.push("finish");
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.deepStrictEqual(received, ["working", "finish"]);
  });

  test("full remote run sequence dispatches all events in order", async () => {
    const events: AgentEvent[] = [
      { start: { objective: { parts: [{ text: "make a joke" }] } } },
      {
        sendRequest: {
          model: "gemini-3-flash-preview",
          body: { contents: [] },
        },
      },
      {
        content: { content: { parts: [{ text: "Here is a joke" }] } },
      },
      {
        functionCall: {
          callId: "call-1",
          name: "system_objective_fulfilled",
          args: { objective_outcome: "A joke about chickens" },
          icon: "check_circle",
          title: "Returning final outcome",
        },
      },
      {
        functionResult: {
          callId: "call-1",
          content: { parts: [{ text: "{}" }] },
        },
      },
      { turnComplete: {} },
      { finish: {} },
      {
        complete: {
          result: {
            success: true,
            href: "/",
            outcomes: { parts: [{ text: "A joke about chickens" }] },
          },
        },
      } as unknown as AgentEvent,
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const timeline: string[] = [];
    let finalOutcomes: unknown;

    consumer
      .on("start", () => {
        timeline.push("start");
      })
      .on("sendRequest", () => {
        timeline.push("sendRequest");
      })
      .on("content", () => {
        timeline.push("content");
      })
      .on("functionCall", () => {
        timeline.push("functionCall");
      })
      .on("functionResult", () => {
        timeline.push("functionResult");
      })
      .on("turnComplete", () => {
        timeline.push("turnComplete");
      })
      .on("finish", () => {
        timeline.push("finish");
      })
      .on("complete", (payload) => {
        timeline.push("complete");
        finalOutcomes = payload.result.outcomes;
      });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.deepStrictEqual(timeline, [
      "start",
      "sendRequest",
      "content",
      "functionCall",
      "functionResult",
      "turnComplete",
      "finish",
      "complete",
    ]);
    assert.deepStrictEqual(finalOutcomes, {
      parts: [{ text: "A joke about chickens" }],
    });
  });

  test("error event is dispatched to consumer and stops stream", async () => {
    const events: AgentEvent[] = [
      { thought: { text: "working" } },
      { error: { message: "Gemini API error 503: model overloaded" } },
      { thought: { text: "after error" } },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];
    let capturedError: string | undefined;

    consumer.on("thought", (payload) => {
      received.push(`thought:${payload.text}`);
    });
    consumer.on("error", (payload) => {
      capturedError = payload.message;
      received.push("error");
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.strictEqual(
      capturedError,
      "Gemini API error 503: model overloaded",
      "error message should be dispatched to consumer"
    );
    assert.deepStrictEqual(received, ["thought:working", "error"]);
  });

  test("throws on session creation failure", async () => {
    mock.method(globalThis, "fetch", async () => {
      return { ok: false, status: 500, statusText: "Internal Server Error" };
    });

    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );

    await assert.rejects(
      () => source.connect(),
      /Session creation failed: 500/
    );
  });

  test("throws on SSE stream failure", async () => {
    let callCount = 0;
    mock.method(
      globalThis,
      "fetch",
      async (_url: string | URL | Request, _init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          return jsonResponse({ sessionId: SESSION_ID });
        }
        return { ok: false, status: 404, statusText: "Not Found", body: null };
      }
    );

    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );

    await assert.rejects(
      () => source.connect(),
      /SSE connection failed: 404/
    );
  });

  test("throws on SSE stream with no body", async () => {
    let callCount = 0;
    mock.method(
      globalThis,
      "fetch",
      async () => {
        callCount++;
        if (callCount === 1) {
          return jsonResponse({ sessionId: SESSION_ID });
        }
        return { ok: true, status: 200, statusText: "OK", body: null };
      }
    );

    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );

    await assert.rejects(
      () => source.connect(),
      /SSE response has no body/
    );
  });

  test("cancel() sends POST to session cancel endpoint", async () => {
    const events: AgentEvent[] = [
      { thought: { text: "working" } },
      { finish: {} },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    // Now cancel — should POST to :cancel.
    await source.cancel();

    const cancelCall = fetchCalls.find((c) =>
      c.url.includes(":cancel")
    );
    assert.ok(cancelCall, "cancel should send a fetch request");
    assert.ok(
      cancelCall.url.includes(`/sessions/${SESSION_ID}:cancel`),
      "cancel URL should include session ID"
    );
    assert.strictEqual(cancelCall.init?.method, "POST");
  });

  test("cancel() does nothing when no session exists", async () => {
    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );

    // No connect() called — sessionId is null.
    // cancel() should not throw or fetch.
    await source.cancel();
    assert.strictEqual(fetchCalls.length, 0);
  });

  test("multiple suspend/resume cycles track cursor correctly", async () => {
    // Three suspend cycles: consent → input → consent → complete.
    // Cursor should advance: stream1 has 2 events (0,1), stream2 has 1 (2),
    // stream3 has 2 (3,4).

    const stream1Events: AgentEvent[] = [
      { thought: { text: "checking consent" } },
      {
        queryConsent: {
          requestId: "req-1",
          interactionId: "int-1",
          capability: "web-access",
        },
      } as unknown as AgentEvent,
    ];

    const stream2Events: AgentEvent[] = [
      {
        waitForInput: {
          requestId: "req-2",
          interactionId: "int-2",
          prompt: { parts: [{ text: "Name?" }], role: "model" },
          inputType: "text",
        },
      },
    ];

    const stream3Events: AgentEvent[] = [
      { thought: { text: "finishing" } },
      {
        complete: {
          result: { success: true, href: "/", outcomes: undefined },
        },
      } as unknown as AgentEvent,
    ];

    let streamCallCount = 0;
    mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: urlStr, init });

        if (urlStr.includes("/sessions/new") && init?.method === "POST") {
          return jsonResponse({ sessionId: SESSION_ID });
        }
        if (urlStr.includes(":resume") && init?.method === "POST") {
          return jsonResponse({ ok: true });
        }
        if (urlStr.includes(`/sessions/${SESSION_ID}`)) {
          streamCallCount++;
          if (streamCallCount === 1) {
            return sseResponse(sessionSseStream(SESSION_ID, stream1Events));
          }
          if (streamCallCount === 2) {
            return sseResponse(
              sessionSseStream(SESSION_ID, stream2Events, 2)
            );
          }
          return sseResponse(
            sessionSseStream(SESSION_ID, stream3Events, 3)
          );
        }
        throw new Error(`Unexpected fetch: ${urlStr}`);
      }
    );

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(`thought:${payload.text}`);
    });
    consumer.on("complete", () => {
      received.push("complete");
    });
    consumer.on("queryConsent", () => {
      return Promise.resolve({ consent: true });
    });
    consumer.on("waitForInput", () => {
      return Promise.resolve({
        input: { parts: [{ text: "Alice" }] },
      });
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    // All events dispatched in order.
    assert.deepStrictEqual(received, [
      "thought:checking consent",
      "thought:finishing",
      "complete",
    ]);

    // 6 calls: create(0), stream1(1), resume1(2), stream2(3), resume2(4), stream3(5).
    assert.strictEqual(fetchCalls.length, 6);

    // Verify cursor on reconnects.
    // Stream 1: no ?after (first connect).
    assert.ok(!fetchCalls[1].url.includes("after="));
    // Stream 2: ?after=1 (saw events 0,1).
    assert.ok(fetchCalls[3].url.includes("after=1"));
    // Stream 3: ?after=2 (saw event 2).
    assert.ok(fetchCalls[5].url.includes("after=2"));
  });
});

suite("AgentService remote mode", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("configureRemote switches to SSEAgentRun", async () => {
    const { AgentService } =
      await import("../../src/a2/agent/agent-service.js");
    const service = new AgentService();
    service.configureRemote("http://localhost:8000");

    const handle = service.startRun({
      kind: "test",
      segments: [{ type: "text", text: "hello" }],
      flags: { useNotebookLM: false, googleOne: false },
      graph: { url: "drive:/test123", title: "Test Opal" },
    });

    // SSEAgentRun should not have sink on the interface
    assert.strictEqual(
      "sink" in handle,
      false,
      "SSEAgentRun should not expose sink"
    );

    service.endRun(handle.runId);
  });

  test("configureRemote(null) reverts to local mode", async () => {
    const { AgentService } =
      await import("../../src/a2/agent/agent-service.js");
    const service = new AgentService();

    service.configureRemote("http://localhost:8000");
    service.configureRemote(null);

    const handle = service.startRun({
      kind: "test",
      objective: { parts: [{ text: "hello" }] },
    });

    // LocalAgentRun exposes sink as a concrete property
    const localHandle = handle as unknown as { sink?: unknown };
    assert.ok(localHandle.sink, "sink should be available in local mode");

    service.endRun(handle.runId);
  });
});
