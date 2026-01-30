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

describe("generate_speech_from_text", () => {
  describe("voice parameter", () => {
    it("passes voice option to generator", async () => {
      let capturedVoice = "";
      const generators = createMockGenerators({
        callAudio: mock.fn(
          async (
            _caps: unknown,
            _moduleArgs: unknown,
            _text: string,
            voice: string
          ) => {
            capturedVoice = voice;
            return fixtures.audioSuccess;
          }
        ) as unknown as Generators["callAudio"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_speech_from_text");

      await handler(
        { text: "Hello world", voice: "Male (English)" },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedVoice, "Male (English)");
    });

    it("passes text to generator", async () => {
      let capturedText = "";
      const generators = createMockGenerators({
        callAudio: mock.fn(
          async (_caps: unknown, _moduleArgs: unknown, text: string) => {
            capturedText = text;
            return fixtures.audioSuccess;
          }
        ) as unknown as Generators["callAudio"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_speech_from_text");

      await handler(
        { text: "Hello world", voice: "Female (English)" },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedText, "Hello world");
    });
  });

  describe("stored data handling", () => {
    it("extracts speech handle from storedData part", async () => {
      let addedPart: DataPart | undefined;
      const fileSystem = createMockFileSystem({
        add: mock.fn((part: DataPart) => {
          addedPart = part;
          return "/vfs/speech.wav";
        }),
      });

      const args = createTestArgs({ fileSystem });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_speech_from_text");

      const result = await handler(
        { text: "Hello", voice: "Female (English)" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { speech?: string };
      assertOk(successResult.speech !== undefined, "Should have speech result");
      deepStrictEqual(successResult.speech, "/vfs/speech.wav");
      assertOk(addedPart !== undefined, "Should add part to file system");
      assertOk("storedData" in addedPart, "Added part should be storedData");
    });
  });

  describe("status updates", () => {
    it("shows 'Generating Speech' with expectedDuration=20", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_speech_from_text");

      const statusUpdater = createMockStatusUpdater();
      await handler(
        { text: "Hello", voice: "Female (English)" },
        statusUpdater
      );

      const calls = statusUpdater.getCalls();
      const speechCall = calls.find((c) => c.message === "Generating Speech");
      assertOk(
        speechCall !== undefined,
        "Should show 'Generating Speech' status"
      );
      deepStrictEqual(speechCall.options?.expectedDurationInSec, 20);
    });
  });

  describe("error handling", () => {
    it("returns error when no speech part produced", async () => {
      const generators = createMockGenerators({
        callAudio: mock.fn(async () => ({
          parts: [],
          role: "model" as const,
        })) as unknown as Generators["callAudio"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_speech_from_text");

      const result = await handler(
        { text: "Hello", voice: "Female (English)" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "No speech was generated"
      );
    });

    it("propagates callAudio errors", async () => {
      const generators = createMockGenerators({
        callAudio: mock.fn(async () =>
          err("Audio generation failed")
        ) as unknown as Generators["callAudio"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_speech_from_text");

      const result = await handler(
        { text: "Hello", voice: "Female (English)" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "Audio generation failed"
      );
    });
  });
});
