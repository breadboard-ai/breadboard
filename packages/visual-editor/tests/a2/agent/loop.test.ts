/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ok } from "@breadboard-ai/utils/outcome.js";
import type { NodeHandlerContext } from "@breadboard-ai/types";
import { Loop } from "../../../src/a2/agent/loop.js";
import type { A2ModuleArgs } from "../../../src/a2/runnable-module-factory.js";

describe("Agent Loop abort-signal handling", () => {
  it("should cleanly terminate and return 'Run was stopped' when abort signal is triggered", async () => {
    const abortController = new AbortController();
    
    // Create a mock fetch that hangs until aborted
    const mockFetch = async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        const onAbort = () => {
          reject(new DOMException("The user aborted a request.", "AbortError"));
        };
        if (init?.signal?.aborted) {
          onAbort();
          return;
        }
        init?.signal?.addEventListener("abort", onAbort);
      });
    };

    const mockArgs = {
      fetchWithCreds: mockFetch as unknown as typeof globalThis.fetch,
      context: {
        signal: abortController.signal,
      } as unknown as NodeHandlerContext,
      agentService: {
        endRun: () => {},
      },
    } as unknown as A2ModuleArgs;

    const loop = new Loop(mockArgs);

    // Start the loop in the background
    const runPromise = loop.run({
      objective: { role: "user", parts: [{ text: "Solve world peace" }] },
      functionGroups: [],
    });

    // Let the event loop cycle so the agent loop starts and hangs on the fetch call
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Abort the run
    abortController.abort();

    const result = await runPromise;

    assert.equal(ok(result), false);
    if (!ok(result)) {
      assert.equal(result.$error, "Run was stopped");
    }
  });
});
