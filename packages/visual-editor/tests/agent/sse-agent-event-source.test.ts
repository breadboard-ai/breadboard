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

/**
 * Create an SSE-formatted ReadableStream from an array of events.
 * Each event is serialized as `data: <json>\n\n`, matching real SSE format.
 */
function sseStream(events: AgentEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }
      controller.close();
    },
  });
}

/**
 * Create a mock fetch response with the given SSE stream.
 */
function mockFetchResponse(body: ReadableStream): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body,
    headers: new Headers(),
  } as unknown as Response;
}

const TEST_CONFIG = { kind: "test", objective: { parts: [{ text: "hi" }] } };

suite("SSEAgentEventSource", () => {
  let fetchCalls: Array<{ url: string; init?: RequestInit }>;

  beforeEach(() => {
    setDOM();
    fetchCalls = [];
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  /** Install a mock fetch that returns the SSE stream for POST requests. */
  function installFetch(events: AgentEvent[]) {
    mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: urlStr, init });
        return mockFetchResponse(sseStream(events));
      }
    );
  }

  test("dispatches fire-and-forget events to consumer", async () => {
    const events: AgentEvent[] = [
      { type: "thought", text: "thinking" },
      { type: "finish" },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: AgentEvent[] = [];

    consumer.on("thought", (event) => {
      received.push(event);
    });
    consumer.on("finish", (event) => {
      received.push(event);
    });

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0].type, "thought");
    assert.strictEqual(received[1].type, "finish");

    // Verify the POST URL and body
    assert.strictEqual(
      fetchCalls[0].url,
      "http://test/v1beta1/streamRunAgent?alt=sse"
    );
    assert.strictEqual(fetchCalls[0].init?.method, "POST");
    const body = JSON.parse(fetchCalls[0].init?.body as string);
    assert.deepStrictEqual(body, { start: TEST_CONFIG });
  });

  test("suspend event triggers reconnect with interactionId", async () => {
    // Reconnect model: when a suspend event arrives (has requestId +
    // interactionId), the client awaits the handler, then POSTs again
    // with {interactionId, response} to resume on a new stream.

    // Stream 1: events → suspend (stream closes)
    const stream1Events: AgentEvent[] = [
      { type: "thought", text: "thinking" },
      {
        type: "waitForInput",
        requestId: "req-42",
        interactionId: "int-abc",
        prompt: { parts: [{ text: "What is your name?" }], role: "model" },
        inputType: "text",
      } as AgentEvent,
    ];

    // Stream 2: resumed events → complete
    const stream2Events: AgentEvent[] = [
      { type: "thought", text: "processing response" },
      {
        type: "complete",
        result: { success: true, href: "/", outcomes: undefined },
      } as AgentEvent,
    ];

    let callCount = 0;
    mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: urlStr, init });
        callCount++;
        if (callCount === 1) {
          return mockFetchResponse(sseStream(stream1Events));
        }
        return mockFetchResponse(sseStream(stream2Events));
      }
    );

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (event) => {
      received.push(`thought:${event.text}`);
    });
    consumer.on("complete", () => {
      received.push("complete");
    });

    // Suspend handler: the consumer returns the user's response.
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

    // Two fetch calls: initial + resume.
    assert.strictEqual(fetchCalls.length, 2);

    // First call: original config wrapped under "start".
    const body1 = JSON.parse(fetchCalls[0].init?.body as string);
    assert.deepStrictEqual(body1, { start: TEST_CONFIG });

    // Second call: resume with interactionId + response under "resume".
    const body2 = JSON.parse(fetchCalls[1].init?.body as string);
    assert.strictEqual(body2.resume.interactionId, "int-abc");
    assert.deepStrictEqual(body2.resume.response, {
      input: { parts: [{ text: "Alice" }] },
    });
  });

  test("processes events between finish and complete", async () => {
    // The server emits `finish` then `complete`. The client must NOT
    // break on `finish` — it needs the `complete` event for outcomes.
    const events: AgentEvent[] = [
      { type: "thought", text: "before finish" },
      { type: "finish" },
      {
        type: "complete",
        result: {
          success: true,
          href: "/",
          outcomes: { parts: [{ text: "the outcome" }] },
        },
      } as AgentEvent,
      // Anything after complete should be ignored
      { type: "thought", text: "after complete" },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (event) => {
      received.push(`thought:${event.text}`);
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

    // All events up to and including `complete` should be dispatched.
    // The thought after `complete` should be ignored.
    assert.deepStrictEqual(received, [
      "thought:before finish",
      "finish",
      "complete",
    ]);
  });

  test("complete event carries AgentResult with outcomes", async () => {
    const outcomeContent = { parts: [{ text: "Why did the chicken..." }] };
    const events: AgentEvent[] = [
      { type: "start", objective: { parts: [{ text: "tell a joke" }] } },
      { type: "finish" },
      {
        type: "complete",
        result: {
          success: true,
          href: "/",
          outcomes: outcomeContent,
        },
      } as AgentEvent,
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    let capturedResult: Record<string, unknown> | undefined;

    consumer.on("start", () => {});
    consumer.on("finish", () => {});
    consumer.on("complete", (event) => {
      capturedResult = event.result as unknown as Record<string, unknown>;
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
    // If the server closes the stream after `finish` (no `complete`),
    // the client should still process all events up to `finish`.
    const events: AgentEvent[] = [
      { type: "thought", text: "working" },
      { type: "finish" },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (event) => {
      received.push(event.text);
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

    // Both events dispatched — stream ended naturally after finish.
    assert.deepStrictEqual(received, ["working", "finish"]);
  });

  test("full remote run sequence dispatches all events in order", async () => {
    // Simulate the full remote run sequence observed during manual testing:
    //   start → sendRequest → content → functionCall → functionResult →
    //   turnComplete → finish → complete
    const events: AgentEvent[] = [
      { type: "start", objective: { parts: [{ text: "make a joke" }] } },
      {
        type: "sendRequest",
        model: "gemini-3-flash-preview",
        body: {} as AgentEvent extends { type: "sendRequest"; body: infer B }
          ? B
          : never,
      } as AgentEvent,
      {
        type: "content",
        content: { parts: [{ text: "Here is a joke" }] },
      },
      {
        type: "functionCall",
        callId: "call-1",
        name: "system_objective_fulfilled",
        args: { objective_outcome: "A joke about chickens" },
        icon: "check_circle",
        title: "Returning final outcome",
      },
      {
        type: "functionResult",
        callId: "call-1",
        content: { parts: [{ text: "{}" }] },
      },
      { type: "turnComplete" },
      { type: "finish" },
      {
        type: "complete",
        result: {
          success: true,
          href: "/",
          outcomes: { parts: [{ text: "A joke about chickens" }] },
        },
      } as AgentEvent,
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
      .on("complete", (event) => {
        timeline.push("complete");
        finalOutcomes = event.result.outcomes;
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

  test("stops on error event", async () => {
    const events: AgentEvent[] = [
      { type: "error", message: "boom" } as AgentEvent,
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    consumer.on("error", () => {});

    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );
    await source.connect();

    // Should complete without throwing
    assert.ok(true);
  });

  test("throws on non-ok response", async () => {
    mock.method(globalThis, "fetch", async () => {
      return { ok: false, status: 404, statusText: "Not Found", body: null };
    });

    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );

    await assert.rejects(() => source.connect(), /SSE connection failed: 404/);
  });

  test("throws on missing body", async () => {
    mock.method(globalThis, "fetch", async () => {
      return { ok: true, status: 200, statusText: "OK", body: null };
    });

    const consumer = new AgentEventConsumer();
    const source = new SSEAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetch
    );

    await assert.rejects(() => source.connect(), /SSE response has no body/);
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
