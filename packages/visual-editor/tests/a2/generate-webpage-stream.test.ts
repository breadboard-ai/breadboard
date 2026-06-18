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

describe("executeWebpageStream", () => {
  let executeWebpageStream: typeof import("../../src/a2/a2/generate-webpage-stream.js").executeWebpageStream;
  let stubModuleArgs: typeof import("../useful-stubs.js").stubModuleArgs;

  beforeEach(async () => {
    setDOM();
    const mod = await import("../../src/a2/a2/generate-webpage-stream.js");
    executeWebpageStream = mod.executeWebpageStream;
    const stubs = await import("../useful-stubs.js");
    stubModuleArgs = stubs.stubModuleArgs;
  });

  afterEach(() => {
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

  it("executes stream via backend client", async () => {
    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response(createSseStream(sseChunks), { status: 200 });
      }),
    };

    const moduleArgs = {
      ...stubModuleArgs,
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
    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "generateWebpageStream");
    assert.equal(options.method, "POST");
    assert.equal(typeof options.body, "object");
    assert.equal(options.body.userInstruction, "Build a webpage");
    assert.deepStrictEqual(options.query, { alt: "sse" });
  });

  it("returns error on non-ok response", async () => {
    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response("Backend Error", { status: 502 });
      }),
    };

    const moduleArgs = {
      ...stubModuleArgs,
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
