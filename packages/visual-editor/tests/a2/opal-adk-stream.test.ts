/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { stubModuleArgs } from "../useful-stubs.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../src/ui/config/client-deployment-configuration.js";
import { ok } from "@breadboard-ai/utils/outcome.js";
import type { LLMContent } from "@breadboard-ai/types";
import type { A2ModuleArgs } from "../../src/a2/runnable-module-factory.js";

// Lazy import — OpalAdkStream touches `window` at module scope via transitive deps.
let OpalAdkStream: typeof import("../../src/a2/a2/opal-adk-stream.js").OpalAdkStream;

/** Creates a ReadableStream that emits SSE-formatted data lines. */
function createSseStream(
  chunks: object[]
): ReadableStream<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });
}

const objective: LLMContent = {
  parts: [{ text: "Test objective" }],
  role: "user",
};

const sseChunks = [
  {
    parts: [
      { text: "Agent result", partMetadata: { chunk_type: "result" } },
    ],
  },
];

describe("OpalAdkStream: ENABLE_BACKEND_CLIENT migration", () => {
  let savedFlag: boolean;

  beforeEach(async () => {
    setDOM();
    const mod = await import("../../src/a2/a2/opal-adk-stream.js");
    OpalAdkStream = mod.OpalAdkStream;
  });

  afterEach(() => {
    if (savedFlag !== undefined) {
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = savedFlag;
    }
    mock.restoreAll();
    unsetDOM();
  });

  function setup(flagOn: boolean) {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = flagOn;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(createSseStream(sseChunks), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
    );

    const backendClientMock = {
      sendHttpRequest: mock.fn(
        async () =>
          new Response(createSseStream(sseChunks), {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          })
      ),
    };

    const moduleArgs: A2ModuleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
      context: {
        signal: new AbortController().signal,
      } as any,
    };

    const stream = new OpalAdkStream(moduleArgs);
    return { stream, fetchMock, backendClientMock, moduleArgs };
  }

  // ---- fetchWithCreds path ----

  it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
    const { stream, fetchMock, backendClientMock } = setup(false);

    const result = await stream.executeOpalAdkStream(objective);

    assert.strictEqual(fetchMock.mock.calls.length, 1);
    assert.strictEqual(
      backendClientMock.sendHttpRequest.mock.calls.length,
      0
    );

    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.ok(url.toString().includes("executeAgentNodeStream"));
    assert.ok(url.toString().includes("alt=sse"));
    assert.strictEqual(init?.method, "POST");
    assert.strictEqual(
      init?.body,
      JSON.stringify({
        objective,
        execution_inputs: {},
        agent_mode_node_config: {},
      })
    );

    assert.ok(ok(result));
  });

  // ---- sendHttpRequest path ----

  it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
    const { stream, fetchMock, backendClientMock } = setup(true);

    const result = await stream.executeOpalAdkStream(objective);

    assert.strictEqual(
      backendClientMock.sendHttpRequest.mock.calls.length,
      1
    );
    assert.strictEqual(fetchMock.mock.calls.length, 0);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, Record<string, unknown>];
    assert.strictEqual(methodName, "executeAgentNodeStream");
    assert.strictEqual(options.method, "POST");
    // Body must be an object, NOT pre-stringified.
    assert.deepStrictEqual(options.body, {
      objective,
      execution_inputs: {},
      agent_mode_node_config: {},
    });
    assert.deepStrictEqual(options.query, { alt: "sse" });

    assert.ok(ok(result));
  });

  // ---- Error handling ----

  it("returns error on non-ok response (flag off)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response("server error", {
          status: 500,
          statusText: "Internal Server Error",
        });
      }
    );

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => new Response("{}", { status: 200 })),
    };

    const moduleArgs: A2ModuleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
      context: {
        signal: new AbortController().signal,
      } as any,
    };

    const stream = new OpalAdkStream(moduleArgs);
    const result = await stream.executeOpalAdkStream(objective);

    assert.ok(!ok(result));
    assert.ok(result.$error.includes("500"));
  });

  it("returns error on non-ok response (flag on)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response("{}", { status: 200 });
      }
    );

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response("backend error", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }),
    };

    const moduleArgs: A2ModuleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
      context: {
        signal: new AbortController().signal,
      } as any,
    };

    const stream = new OpalAdkStream(moduleArgs);
    const result = await stream.executeOpalAdkStream(objective);

    assert.ok(!ok(result));
    assert.ok(result.$error.includes("503"));
  });
});
