/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { mock, suite, test, beforeEach, afterEach } from "node:test";
import { StreamRunAgentEventSource } from "../../src/a2/agent/stream-run-agent-event-source.js";
import { AgentEventConsumer } from "../../src/a2/agent/agent-event-consumer.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });
}

function sseResponse(events: object[]): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: sseStream(events),
    headers: new Headers({ "content-type": "text/event-stream" }),
  } as unknown as Response;
}

const TEST_CONFIG = { kind: "test", objective: { parts: [{ text: "hi" }] } };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("StreamRunAgentEventSource", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  test("sends HTTP request to backend client", async () => {
    const events = [{ finish: {} }];
    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => sseResponse(events)),
    };

    const consumer = new AgentEventConsumer();
    consumer.on("finish", () => {});

    const source = new StreamRunAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      undefined,
      Promise.resolve(backendClientMock as any)
    );
    await source.connect();

    assert.strictEqual(backendClientMock.sendHttpRequest.mock.calls.length, 1);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.strictEqual(methodName, "streamRunAgent");
    assert.strictEqual(options.method, "POST");
    assert.deepStrictEqual(options.body, { start: TEST_CONFIG });
    assert.deepStrictEqual(options.query, { alt: "sse" });
  });

  test("returns error on non-ok response", async () => {
    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      })),
    };

    const consumer = new AgentEventConsumer();
    const source = new StreamRunAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      undefined,
      Promise.resolve(backendClientMock as any)
    );

    await assert.rejects(
      () => source.connect(),
      /SSE connection failed: 503/
    );
  });
});
