/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import { deepStrictEqual, ok as assertOk, fail } from "node:assert";
import { err } from "@breadboard-ai/utils/outcome.js";
import { getGenerateFunctionGroup } from "../../../src/a2/agent/functions/generate.js";
import type { Generators } from "../../../src/a2/agent/types.js";
import type { DataPart } from "@breadboard-ai/types";
import {
  createMockGenerators,
  createTestArgs,
  createMockStatusUpdater,
  createMockFileSystem,
  getHandler,
  fixtures,
} from "./generate-test-utils.js";

/**
 * Helper to check if result is a success (no error property).
 */
function isSuccess(result: unknown): boolean {
  return !(result && typeof result === "object" && "error" in result);
}

describe("generate_music_from_text", () => {
  describe("prompt handling", () => {
    it("passes prompt to generator", async () => {
      let capturedPrompt = "";
      const generators = createMockGenerators({
        callMusic: mock.fn(
          async (_caps: unknown, _moduleArgs: unknown, prompt: string) => {
            capturedPrompt = prompt;
            return fixtures.musicSuccess;
          }
        ) as unknown as Generators["callMusic"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_music_from_text");

      await handler(
        { prompt: "An upbeat electronic track" },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedPrompt, "An upbeat electronic track");
    });
  });

  describe("stored data handling", () => {
    it("extracts music handle from storedData part", async () => {
      let addedPart: DataPart | undefined;
      const fileSystem = createMockFileSystem({
        add: mock.fn((part: DataPart) => {
          addedPart = part;
          return "/mnt/music.wav";
        }),
      });

      const args = createTestArgs({ fileSystem });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_music_from_text");

      const result = await handler(
        { prompt: "Jazz piano" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { music?: string };
      assertOk(successResult.music !== undefined, "Should have music result");
      deepStrictEqual(successResult.music, "/mnt/music.wav");
      assertOk(addedPart !== undefined, "Should add part to file system");
      assertOk("storedData" in addedPart, "Added part should be storedData");
    });
  });

  describe("status updates", () => {
    it("shows 'Generating Music' with expectedDuration=30", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_music_from_text");

      const statusUpdater = createMockStatusUpdater();
      await handler({ prompt: "Jazz piano" }, statusUpdater);

      const calls = statusUpdater.getCalls();
      const musicCall = calls.find((c) => c.message === "Generating Music");
      assertOk(
        musicCall !== undefined,
        "Should show 'Generating Music' status"
      );
      deepStrictEqual(musicCall.options?.expectedDurationInSec, 30);
    });
  });

  describe("error handling", () => {
    it("returns error when no music part produced", async () => {
      const generators = createMockGenerators({
        callMusic: mock.fn(async () => ({
          parts: [],
          role: "model" as const,
        })) as unknown as Generators["callMusic"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_music_from_text");

      const result = await handler(
        { prompt: "Jazz piano" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      // Note: The actual error message says "No speech was generated" due to copy-paste in source
      deepStrictEqual(
        (result as { error: string }).error,
        "No speech was generated"
      );
    });

    it("propagates callMusic errors", async () => {
      const generators = createMockGenerators({
        callMusic: mock.fn(async () =>
          err("Music generation failed")
        ) as unknown as Generators["callMusic"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_music_from_text");

      const result = await handler(
        { prompt: "Jazz piano" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "Music generation failed"
      );
    });
  });
});
