/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { stubModuleArgs } from "../useful-stubs.js";
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

describe("OpalAdkStream", () => {
  beforeEach(async () => {
    setDOM();
    const mod = await import("../../src/a2/a2/opal-adk-stream.js");
    OpalAdkStream = mod.OpalAdkStream;
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  function setup() {
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
      backendClient: Promise.resolve(backendClientMock as any),
      context: {
        signal: new AbortController().signal,
      } as any,
    };

    const stream = new OpalAdkStream(moduleArgs);
    return { stream, backendClientMock, moduleArgs };
  }

  it("executes stream via backend client", async () => {
    const { stream, backendClientMock } = setup();

    const result = await stream.executeOpalAdkStream(objective);

    assert.strictEqual(
      backendClientMock.sendHttpRequest.mock.calls.length,
      1
    );

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, Record<string, unknown>];
    assert.strictEqual(methodName, "executeAgentNodeStream");
    assert.strictEqual(options.method, "POST");
    assert.deepStrictEqual(options.body, {
      objective,
      execution_inputs: {},
      agent_mode_node_config: {},
    });
    assert.deepStrictEqual(options.query, { alt: "sse" });

    assert.ok(ok(result));
  });

  it("returns error on non-ok response", async () => {
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
