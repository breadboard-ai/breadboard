/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ok } from "@breadboard-ai/utils/outcome.js";
import type { NodeHandlerContext } from "@breadboard-ai/types";
import { streamGenerateContent } from "../../src/a2/a2/gemini.js";
import type { A2ModuleArgs } from "../../src/a2/runnable-module-factory.js";
import type { GeminiAPIOutputs } from "../../src/a2/a2/gemini.js";

// Helper to create chunk encoder for SSE streams
function sseChunk(data: unknown): Uint8Array {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

// Simple mock for A2ModuleArgs
function makeMockModuleArgs(
  fetchResponses: Array<{ status: number; ok: boolean; body?: unknown; chunks?: unknown[] }>
): A2ModuleArgs {
  let callCount = 0;
  const mockFetch = async (_url: string, _init?: unknown) => {
    const nextResponse = fetchResponses[callCount] || fetchResponses[fetchResponses.length - 1];
    callCount++;

    if (!nextResponse.ok) {
      return new Response(JSON.stringify(nextResponse.body || {}), {
        status: nextResponse.status,
      });
    }

    if (nextResponse.chunks) {
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of nextResponse.chunks!) {
            controller.enqueue(sseChunk(chunk));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }

    return new Response(JSON.stringify(nextResponse.body || {}), { status: 200 });
  };

  return {
    fetchWithCreds: mockFetch as unknown as typeof globalThis.fetch,
    context: {
      signal: new AbortController().signal,
    } as unknown as NodeHandlerContext,
  } as unknown as A2ModuleArgs;
}

describe("Gemini streamGenerateContent retry logic", () => {
  it("should succeed immediately when first chunk has content", async () => {
    const mockArgs = makeMockModuleArgs([
      {
        ok: true,
        status: 200,
        chunks: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Hello world" }],
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await streamGenerateContent("model-name", { contents: [] }, mockArgs);
    if (!ok(result)) {
      assert.fail(`Expected success, got: ${result.$error}`);
    }

    const chunks: GeminiAPIOutputs[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    assert.equal(chunks.length, 1);
    const part = chunks[0]?.candidates?.[0]?.content?.parts?.[0];
    assert.ok(part && "text" in part);
    assert.equal(part.text, "Hello world");
  });

  it("should retry and succeed when first attempt returns a transient INTERNAL error", async () => {
    const mockArgs = makeMockModuleArgs([
      {
        ok: true,
        status: 200,
        chunks: [
          {
            errorMessage: JSON.stringify({
              code: "INTERNAL",
              message: "An unexpected error occurred. Please try again.",
            }),
          },
        ],
      },
      {
        ok: true,
        status: 200,
        chunks: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Recovered output" }],
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await streamGenerateContent("model-name", { contents: [] }, mockArgs);
    if (!ok(result)) {
      assert.fail(`Expected success, got: ${result.$error}`);
    }

    const chunks: GeminiAPIOutputs[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    assert.equal(chunks.length, 1);
    const part = chunks[0]?.candidates?.[0]?.content?.parts?.[0];
    assert.ok(part && "text" in part);
    assert.equal(part.text, "Recovered output");
  });

  it("should fail immediately without retry on non-retryable error (e.g. INVALID_ARGUMENT)", async () => {
    const mockArgs = makeMockModuleArgs([
      {
        ok: true,
        status: 200,
        chunks: [
          {
            errorMessage: JSON.stringify({
              code: "INVALID_ARGUMENT",
              message: "Invalid prompt structure",
            }),
          },
        ],
      },
    ]);

    const result = await streamGenerateContent("model-name", { contents: [] }, mockArgs);
    if (ok(result)) {
      assert.fail("Expected failure");
    }
    assert.equal(result.$error.includes("Invalid prompt structure"), true);
  });

  it("should retry and succeed when HTTP status 503 is returned", async () => {
    const mockArgs = makeMockModuleArgs([
      {
        ok: false,
        status: 503,
        body: { message: "Service Unavailable" },
      },
      {
        ok: true,
        status: 200,
        chunks: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Success after HTTP retry" }],
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await streamGenerateContent("model-name", { contents: [] }, mockArgs);
    if (!ok(result)) {
      assert.fail(`Expected success, got: ${result.$error}`);
    }

    const chunks: GeminiAPIOutputs[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    assert.equal(chunks.length, 1);
    const part = chunks[0]?.candidates?.[0]?.content?.parts?.[0];
    assert.ok(part && "text" in part);
    assert.equal(part.text, "Success after HTTP retry");
  });

  it("should fail immediately on HTTP status 400 without retrying", async () => {
    const mockArgs = makeMockModuleArgs([
      {
        ok: false,
        status: 400,
        body: { error: { message: "Bad Request" } },
      },
    ]);

    const result = await streamGenerateContent("model-name", { contents: [] }, mockArgs);
    if (ok(result)) {
      assert.fail("Expected failure");
    }
    assert.equal(result.$error.includes("Bad Request"), true);
  });

  it("should retry and succeed when a retryable error occurs inside the buffering loop", async () => {
    const mockArgs = makeMockModuleArgs([
      {
        ok: true,
        status: 200,
        chunks: [
          // First chunk is empty (e.g. metadata/usage only), triggering buffering
          { candidates: [] },
          // Second chunk has retryable error
          {
            errorMessage: JSON.stringify({
              code: "INTERNAL",
              message: "Intermittent stream failure",
            }),
          },
        ],
      },
      {
        ok: true,
        status: 200,
        chunks: [
          {
            candidates: [
              {
                content: {
                  parts: [{ text: "Recovered during buffering" }],
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await streamGenerateContent("model-name", { contents: [] }, mockArgs);
    if (!ok(result)) {
      assert.fail(`Expected success, got: ${result.$error}`);
    }

    const chunks: GeminiAPIOutputs[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    assert.equal(chunks.length, 1);
    const part = chunks[0]?.candidates?.[0]?.content?.parts?.[0];
    assert.ok(part && "text" in part);
    assert.equal(part.text, "Recovered during buffering");
  });
});
