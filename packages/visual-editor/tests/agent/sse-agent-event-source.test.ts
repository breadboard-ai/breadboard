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

suite("SSEAgentEventSource", () => {
  let fetchCalls: Array<{ url: string; init?: RequestInit }>;
  let postBodies: Array<{ url: string; body: unknown }>;

  beforeEach(() => {
    setDOM();
    fetchCalls = [];
    postBodies = [];
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  /** Install a mock fetch that returns the SSE stream for GET, records POSTs */
  function installFetch(events: AgentEvent[]) {
    mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ url: urlStr, init });

        if (!init?.method || init.method === "GET") {
          // SSE stream response
          return mockFetchResponse(sseStream(events));
        }

        // POST (input endpoint)
        postBodies.push({
          url: urlStr,
          body: init.body ? JSON.parse(init.body as string) : null,
        });
        return { ok: true, status: 200 };
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
      "run-1",
      consumer,
      fetch
    );
    await source.connect();

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0].type, "thought");
    assert.strictEqual(received[1].type, "finish");

    // Verify the GET URL
    assert.strictEqual(fetchCalls[0].url, "http://test/api/agent/run-1/events");
  });

  test("suspend events trigger POST to /input", async () => {
    const events: AgentEvent[] = [
      {
        type: "waitForInput",
        requestId: "req-42",
        prompt: { parts: [{ text: "What?" }], role: "model" },
        inputType: "text",
      } as AgentEvent,
      { type: "finish" },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();

    consumer.on("waitForInput", () => {
      // Simulate UI returning a response
      return Promise.resolve({ input: { parts: [{ text: "hello" }] } });
    });
    consumer.on("finish", () => {});

    const source = new SSEAgentEventSource(
      "http://test",
      "run-1",
      consumer,
      fetch
    );
    await source.connect();

    assert.strictEqual(postBodies.length, 1);
    assert.strictEqual(postBodies[0].url, "http://test/api/agent/run-1/input");
    assert.deepStrictEqual(postBodies[0].body, {
      request_id: "req-42",
      response: { input: { parts: [{ text: "hello" }] } },
    });
  });

  test("stops on finish event", async () => {
    const events: AgentEvent[] = [
      { type: "thought", text: "before finish" },
      { type: "finish" },
      // Anything after finish should be ignored
      { type: "thought", text: "after finish" },
    ];
    installFetch(events);

    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (event) => {
      received.push(event.text);
    });
    consumer.on("finish", () => {});

    const source = new SSEAgentEventSource(
      "http://test",
      "run-1",
      consumer,
      fetch
    );
    await source.connect();

    assert.deepStrictEqual(received, ["before finish"]);
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
      "run-1",
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
      "run-1",
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
      "run-1",
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
      objective: { parts: [{ text: "hello" }] },
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
