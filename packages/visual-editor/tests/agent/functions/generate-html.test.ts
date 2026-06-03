/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import { deepStrictEqual, ok as assertOk } from "node:assert";
import { getGenerateFunctionGroup } from "../../../src/a2/agent/functions/generate.js";
import type { A2ModuleArgs } from "../../../src/a2/runnable-module-factory.js";
import {
  createTestArgs,
  createMockStatusUpdater,
  getHandler,
} from "./generate-test-utils.js";
import { RuntimeFlags, RuntimeFlagManager } from "@breadboard-ai/types";

// Helper to create chunk encoder for SSE streams
function sseChunk(data: unknown): Uint8Array {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

function makeMockFetch(chunks: unknown[]) {
  return mock.fn(async (_url: string, _init?: RequestInit) => {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(sseChunk(chunk));
        }
        controller.close();
      },
    });
    return new Response(stream, { status: 200 });
  });
}

describe("generate_html", () => {
  it("generates html successfully and stores it in the file system", async () => {
    const fetchWithCreds = makeMockFetch([
      {
        parts: [
          {
            text: "<html><body>Generated HTML Page</body></html>",
            partMetadata: { chunk_type: "html" },
          },
        ],
      },
    ]);

    const runtimeFlags = {
      enableGenerateHtml: true,
    } as unknown as RuntimeFlags;

    const args = createTestArgs({
      runtimeFlags,
      moduleArgs: {
        fetchWithCreds: fetchWithCreds as unknown as typeof globalThis.fetch,
        context: {
          currentGraph: { url: "drive:/test-stub", title: "Test Stub" },
          flags: {
            flags: async () => runtimeFlags,
          } as unknown as RuntimeFlagManager,
        },
      } as unknown as A2ModuleArgs,
    });

    const group = getGenerateFunctionGroup(args);
    const handler = getHandler(group, "generate_html");

    const result = await handler(
      {
        prompt: "Generate a simple page",
        status_update: "Designing webpage",
        file_name: "index.html",
      },
      createMockStatusUpdater()
    );

    deepStrictEqual(result, { html: "/mnt/index.html" });

    // Verify fetch was called with the correct backend URL
    assertOk(fetchWithCreds.mock.calls.length > 0);
    const fetchUrl = fetchWithCreds.mock.calls[0].arguments[0] as string;
    assertOk(fetchUrl.includes("v1beta1/generateWebpageStream"));

    // Verify userInstruction matches input prompt and incorporates default theme fallback
    const body = JSON.parse(fetchWithCreds.mock.calls[0].arguments[1]!.body as string);
    assertOk(body.userInstruction.includes("Unless otherwise specified, use the following theme colors:"));
  });

  it("appends graph palette settings to the prompt system instruction when available", async () => {
    const fetchWithCreds = makeMockFetch([
      {
        parts: [
          {
            text: "<html><body>Palette Page</body></html>",
            partMetadata: { chunk_type: "html" },
          },
        ],
      },
    ]);

    const runtimeFlags = {
      enableGenerateHtml: true,
    } as unknown as RuntimeFlags;

    const args = createTestArgs({
      runtimeFlags,
      moduleArgs: {
        fetchWithCreds: fetchWithCreds as unknown as typeof globalThis.fetch,
        context: {
          currentGraph: {
            url: "drive:/test-stub",
            title: "Test Stub",
            metadata: {
              visual: {
                presentation: {
                  theme: "custom-theme",
                  themes: {
                    "custom-theme": {
                      palette: {
                        primary: {
                          25: "#000000",
                          98: "#ffffff",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          flags: {
            flags: async () => runtimeFlags,
          } as unknown as RuntimeFlagManager,
        },
      } as unknown as A2ModuleArgs,
    });

    const group = getGenerateFunctionGroup(args);
    const handler = getHandler(group, "generate_html");

    await handler(
      {
        prompt: "Generate a custom page",
        status_update: "Designing webpage",
        file_name: "custom",
      },
      createMockStatusUpdater()
    );

    assertOk(fetchWithCreds.mock.calls.length > 0);
    const body = JSON.parse(fetchWithCreds.mock.calls[0].arguments[1]!.body as string);
    assertOk(body.userInstruction.includes("primary color, dark: #000000"));
    assertOk(body.userInstruction.includes("primary color, light: #ffffff"));
  });

  it("returns error message when streaming generation fails", async () => {
    const fetchWithCreds = makeMockFetch([
      {
        parts: [
          {
            text: "Backend failed to compile HTML",
            partMetadata: { chunk_type: "error" },
          },
        ],
      },
    ]);

    const runtimeFlags = {
      enableGenerateHtml: true,
    } as unknown as RuntimeFlags;

    const args = createTestArgs({
      runtimeFlags,
      moduleArgs: {
        fetchWithCreds: fetchWithCreds as unknown as typeof globalThis.fetch,
        context: {
          currentGraph: { url: "drive:/test-stub", title: "Test Stub" },
          flags: {
            flags: async () => runtimeFlags,
          } as unknown as RuntimeFlagManager,
        },
      } as unknown as A2ModuleArgs,
    });

    const group = getGenerateFunctionGroup(args);
    const handler = getHandler(group, "generate_html");

    const result = await handler(
      {
        prompt: "Generate faulty page",
        status_update: "Designing webpage",
      },
      createMockStatusUpdater()
    );

    deepStrictEqual(result, { error: "Backend failed to compile HTML" });
  });
});
