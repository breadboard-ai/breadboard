/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

function createSseStream(chunks: object[]): ReadableStream<Uint8Array> {
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

describe("executeWebpageStream ENABLE_BACKEND_CLIENT migration", () => {
  let executeWebpageStream: typeof import("../../src/a2/a2/generate-webpage-stream.js").executeWebpageStream;
  let CLIENT_DEPLOYMENT_CONFIG: typeof import("../../src/ui/config/client-deployment-configuration.js").CLIENT_DEPLOYMENT_CONFIG;
  let stubModuleArgs: typeof import("../useful-stubs.js").stubModuleArgs;
  let savedFlag: boolean;

  beforeEach(async () => {
    setDOM();
    const mod = await import("../../src/a2/a2/generate-webpage-stream.js");
    executeWebpageStream = mod.executeWebpageStream;
    const configMod = await import(
      "../../src/ui/config/client-deployment-configuration.js"
    );
    CLIENT_DEPLOYMENT_CONFIG = configMod.CLIENT_DEPLOYMENT_CONFIG;
    const stubs = await import("../useful-stubs.js");
    stubModuleArgs = stubs.stubModuleArgs;
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
  });

  afterEach(() => {
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = savedFlag;
    mock.restoreAll();
    unsetDOM();
  });

  const sseChunks = [
    {
      parts: [
        { text: "<h1>Hello</h1>", partMetadata: { chunk_type: "html" } },
      ],
    },
  ];

  it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(createSseStream(sseChunks), { status: 200 });
      }
    );

    const moduleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      context: {
        signal: new AbortController().signal,
      },
    };

    const result = await executeWebpageStream(
      moduleArgs as any,
      "Build a webpage",
      [{ parts: [{ text: "some context" }], role: "user" }]
    );

    assert.ok(ok(result));
    assert.equal(fetchMock.mock.calls.length, 1);

    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.ok(url.toString().includes("generateWebpageStream"));
    assert.ok(url.toString().includes("alt=sse"));
    assert.equal(init?.method, "POST");
    assert.ok(typeof init?.body === "string");
    const parsedBody = JSON.parse(init!.body as string);
    assert.equal(parsedBody.userInstruction, "Build a webpage");
  });

  it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response(createSseStream(sseChunks), { status: 200 });
      }),
    };

    const fetchMock = mock.fn();

    const moduleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
      context: {
        signal: new AbortController().signal,
      },
    };

    const result = await executeWebpageStream(
      moduleArgs as any,
      "Build a webpage",
      [{ parts: [{ text: "some context" }], role: "user" }]
    );

    assert.ok(ok(result));
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "generateWebpageStream");
    assert.equal(options.method, "POST");
    // body must be an object, not stringified
    assert.equal(typeof options.body, "object");
    assert.equal(options.body.userInstruction, "Build a webpage");
    assert.deepStrictEqual(options.query, { alt: "sse" });
  });

  it("returns error on non-ok response (flag off)", async () => {
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response("Internal Server Error", { status: 500 });
      }
    );

    const moduleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      context: {
        signal: new AbortController().signal,
      },
    };

    const result = await executeWebpageStream(
      moduleArgs as any,
      "Build a webpage",
      [{ parts: [{ text: "some context" }], role: "user" }]
    );

    assert.ok(!ok(result));
    assert.ok(result.$error.includes("500"));
  });

  it("returns error on non-ok response (flag on)", async () => {
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response("Backend Error", { status: 502 });
      }),
    };

    const moduleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: mock.fn() as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
      context: {
        signal: new AbortController().signal,
      },
    };

    const result = await executeWebpageStream(
      moduleArgs as any,
      "Build a webpage",
      [{ parts: [{ text: "some context" }], role: "user" }]
    );

    assert.ok(!ok(result));
    assert.ok(result.$error.includes("502"));
  });
});
