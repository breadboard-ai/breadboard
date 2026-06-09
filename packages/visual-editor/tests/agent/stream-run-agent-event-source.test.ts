/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { mock, suite, test, beforeEach, afterEach } from "node:test";
import { StreamRunAgentEventSource } from "../../src/a2/agent/stream-run-agent-event-source.js";
import { AgentEventConsumer } from "../../src/a2/agent/agent-event-consumer.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../src/ui/config/client-deployment-configuration.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseStream(events: object[]): ReadableStream<Uint8Array> {
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

suite("StreamRunAgentEventSource: ENABLE_BACKEND_CLIENT migration", () => {
  let savedFlag: boolean;

  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    if (savedFlag !== undefined) {
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = savedFlag;
    }
    mock.restoreAll();
    unsetDOM();
  });

  test("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const events = [{ finish: {} }];
    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) =>
        sseResponse(events)
    );

    const consumer = new AgentEventConsumer();
    consumer.on("finish", () => {});

    const source = new StreamRunAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetchMock as unknown as typeof fetch,
      undefined, // signal
      Promise.resolve({} as any) // backendClient (should not be used)
    );
    await source.connect();

    assert.strictEqual(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.ok(
      url.toString().includes("/v1beta1/streamRunAgent?alt=sse"),
      `Expected URL to include streamRunAgent?alt=sse, got: ${url}`
    );
    assert.strictEqual(init?.method, "POST");
    const body = JSON.parse(init?.body as string);
    assert.deepStrictEqual(body, { start: TEST_CONFIG });
  });

  test("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const events = [{ finish: {} }];
    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => sseResponse(events)),
    };
    const fetchMock = mock.fn();

    const consumer = new AgentEventConsumer();
    consumer.on("finish", () => {});

    const source = new StreamRunAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetchMock as unknown as typeof fetch,
      undefined,
      Promise.resolve(backendClientMock as any)
    );
    await source.connect();

    assert.strictEqual(fetchMock.mock.calls.length, 0);
    assert.strictEqual(backendClientMock.sendHttpRequest.mock.calls.length, 1);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.strictEqual(methodName, "streamRunAgent");
    assert.strictEqual(options.method, "POST");
    assert.deepStrictEqual(options.body, { start: TEST_CONFIG });
    assert.deepStrictEqual(options.query, { alt: "sse" });
  });

  test("returns error on non-ok response (flag off)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    }));

    const consumer = new AgentEventConsumer();
    const source = new StreamRunAgentEventSource(
      "http://test",
      TEST_CONFIG,
      consumer,
      fetchMock as unknown as typeof fetch
    );

    await assert.rejects(
      () => source.connect(),
      /SSE connection failed: 500/
    );
  });

  test("returns error on non-ok response (flag on)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

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
      mock.fn() as unknown as typeof fetch,
      undefined,
      Promise.resolve(backendClientMock as any)
    );

    await assert.rejects(
      () => source.connect(),
      /SSE connection failed: 503/
    );
  });
});
