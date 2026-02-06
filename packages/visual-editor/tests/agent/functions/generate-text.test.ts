/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import { deepStrictEqual, ok as assertOk, fail } from "node:assert";
import { err } from "@breadboard-ai/utils/outcome.js";
import { getGenerateFunctionGroup } from "../../../src/a2/agent/functions/generate.js";
import type {
  GeminiBody,
  GeminiAPIOutputs,
  Tool,
} from "../../../src/a2/a2/gemini.js";
import type { Generators } from "../../../src/a2/agent/types.js";
import {
  createMockGenerators,
  createStreamResponse,
  createTestArgs,
  createMockStatusUpdater,
  getHandler,
  fixtures,
  createMockTranslator,
  createCandidate,
} from "./generate-test-utils.js";

/**
 * Helper to check if result is a success (no error property).
 */
function isSuccess(result: unknown): boolean {
  return !(result && typeof result === "object" && "error" in result);
}

describe("generate_text", () => {
  describe("model selection", () => {
    it("uses flash model when model='flash'", async () => {
      let capturedModel = "";
      const generators = createMockGenerators({
        streamContent: mock.fn(async (model: string) => {
          capturedModel = model;
          return createStreamResponse([fixtures.textStreamSuccess]);
        }) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "flash" },
        createMockStatusUpdater()
      );

      assertOk(
        capturedModel.includes("flash"),
        `Expected flash model, got: ${capturedModel}`
      );
    });

    it("uses pro model when model='pro'", async () => {
      let capturedModel = "";
      const generators = createMockGenerators({
        streamContent: mock.fn(async (model: string) => {
          capturedModel = model;
          return createStreamResponse([fixtures.textStreamSuccess]);
        }) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "pro" },
        createMockStatusUpdater()
      );

      assertOk(
        capturedModel.includes("pro"),
        `Expected pro model, got: ${capturedModel}`
      );
    });

    it("uses lite model when model='lite'", async () => {
      let capturedModel = "";
      const generators = createMockGenerators({
        streamContent: mock.fn(async (model: string) => {
          capturedModel = model;
          return createStreamResponse([fixtures.textStreamSuccess]);
        }) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "lite" },
        createMockStatusUpdater()
      );

      assertOk(
        capturedModel.includes("lite") || capturedModel.includes("flash"),
        `Expected lite or flash model, got: ${capturedModel}`
      );
    });
  });

  describe("grounding and tools", () => {
    it("adds googleSearch tool when search_grounding=true", async () => {
      let capturedBody: GeminiBody | undefined;
      const generators = createMockGenerators({
        conformBody: mock.fn(async (_moduleArgs: unknown, body: GeminiBody) => {
          capturedBody = body;
          return body;
        }) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "flash", search_grounding: true },
        createMockStatusUpdater()
      );

      assertOk(capturedBody !== undefined, "Body should be captured");
      assertOk(capturedBody.tools !== undefined, "Tools should be defined");
      const hasGoogleSearch = capturedBody.tools.some(
        (t: Tool) => "googleSearch" in t
      );
      assertOk(hasGoogleSearch, "Should include googleSearch tool");
    });

    it("adds googleMaps tool when maps_grounding=true", async () => {
      let capturedBody: GeminiBody | undefined;
      const generators = createMockGenerators({
        conformBody: mock.fn(async (_moduleArgs: unknown, body: GeminiBody) => {
          capturedBody = body;
          return body;
        }) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "flash", maps_grounding: true },
        createMockStatusUpdater()
      );

      assertOk(capturedBody !== undefined, "Body should be captured");
      assertOk(capturedBody.tools !== undefined, "Tools should be defined");
      const hasGoogleMaps = capturedBody.tools.some(
        (t: Tool) => "googleMaps" in t
      );
      assertOk(hasGoogleMaps, "Should include googleMaps tool");
    });

    it("adds urlContext tool when url_context=true and consent granted", async () => {
      let capturedBody: GeminiBody | undefined;
      const generators = createMockGenerators({
        conformBody: mock.fn(async (_moduleArgs: unknown, body: GeminiBody) => {
          capturedBody = body;
          return body;
        }) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "flash", url_context: true },
        createMockStatusUpdater()
      );

      assertOk(capturedBody !== undefined, "Body should be captured");
      assertOk(capturedBody.tools !== undefined, "Tools should be defined");
      const hasUrlContext = capturedBody.tools.some(
        (t: Tool) => "urlContext" in t
      );
      assertOk(hasUrlContext, "Should include urlContext tool");
    });

    it("has no tools array when no grounding options enabled", async () => {
      let capturedBody: GeminiBody | undefined;
      const generators = createMockGenerators({
        conformBody: mock.fn(async (_moduleArgs: unknown, body: GeminiBody) => {
          capturedBody = body;
          return body;
        }) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "flash" },
        createMockStatusUpdater()
      );

      assertOk(capturedBody !== undefined, "Body should be captured");
      deepStrictEqual(
        capturedBody.tools,
        undefined,
        "Tools should be undefined"
      );
    });
  });

  describe("consent flow", () => {
    it("returns error when user declines url_context consent", async () => {
      const baseArgs = createTestArgs();
      const args = createTestArgs({
        moduleArgs: {
          ...baseArgs.moduleArgs,
          getConsentController: () => ({
            queryConsent: async () => false,
          }),
        } as unknown as typeof baseArgs.moduleArgs,
      });

      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const result = await handler(
        { prompt: "Test", model: "flash", url_context: true },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "User declined to consent to access URLs"
      );
    });
  });

  describe("thinking configuration", () => {
    it("includes thinkingLevel=high for pro model", async () => {
      let capturedBody: GeminiBody | undefined;
      const generators = createMockGenerators({
        conformBody: mock.fn(async (_moduleArgs: unknown, body: GeminiBody) => {
          capturedBody = body;
          return body;
        }) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      await handler(
        { prompt: "Test", model: "pro" },
        createMockStatusUpdater()
      );

      assertOk(capturedBody !== undefined, "Body should be captured");
      assertOk(
        capturedBody.generationConfig?.thinkingConfig !== undefined,
        "ThinkingConfig should be defined for pro"
      );
      deepStrictEqual(
        capturedBody.generationConfig?.thinkingConfig?.thinkingLevel,
        "high"
      );
    });
  });

  describe("streaming and merging", () => {
    it("merges text parts from stream", async () => {
      const multiChunkStream: GeminiAPIOutputs[] = [
        { candidates: [createCandidate([{ text: "Hello " }])] },
        { candidates: [createCandidate([{ text: "World" }])] },
      ];

      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          createStreamResponse(multiChunkStream)
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const result = await handler(
        { prompt: "Test", model: "flash" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { text?: string };
      assertOk(successResult.text !== undefined, "Should have text result");
      assertOk(
        successResult.text.includes("Hello") &&
          successResult.text.includes("World"),
        `Should merge text parts, got: ${successResult.text}`
      );
    });

    it("routes thought parts to status updater", async () => {
      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          createStreamResponse([fixtures.textStreamWithThought])
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const statusUpdater = createMockStatusUpdater();
      await handler({ prompt: "Test", model: "flash" }, statusUpdater);

      const calls = statusUpdater.getCalls();
      const thoughtCalls = calls.filter((c) => c.options?.isThought === true);
      assertOk(
        thoughtCalls.length > 0,
        "Should route thoughts to status updater with isThought flag"
      );
    });
  });

  describe("error handling", () => {
    it("propagates translator errors", async () => {
      const translator = createMockTranslator({
        fromPidginString: mock.fn(async () => err("Translation failed")),
      });

      const args = createTestArgs({ translator });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const result = await handler(
        { prompt: "Test", model: "flash" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "Translation failed"
      );
    });

    it("propagates conformBody errors", async () => {
      const generators = createMockGenerators({
        conformBody: mock.fn(async () =>
          err("ConformBody failed")
        ) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const result = await handler(
        { prompt: "Test", model: "flash" },
        createMockStatusUpdater()
      );

      // conformBody error is returned directly (with $error), not wrapped in { error: ... }
      const hasError =
        "$error" in (result as object) || "error" in (result as object);
      assertOk(hasError, "Should return error");
      const errorMsg =
        "$error" in (result as object)
          ? (result as { $error: string }).$error
          : (result as { error: string }).error;
      deepStrictEqual(errorMsg, "ConformBody failed");
    });

    it("propagates stream errors", async () => {
      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          err("Stream failed")
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const result = await handler(
        { prompt: "Test", model: "flash" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual((result as { error: string }).error, "Stream failed");
    });
  });

  describe("status updates", () => {
    it("shows 'Researching' when grounding enabled", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const statusUpdater = createMockStatusUpdater();
      await handler(
        { prompt: "Test", model: "flash", search_grounding: true },
        statusUpdater
      );

      const calls = statusUpdater.getCalls();
      const researchingCall = calls.find((c) => c.message === "Researching");
      assertOk(
        researchingCall !== undefined,
        "Should show 'Researching' status"
      );
    });

    it("shows 'Generating Text' when no grounding", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const statusUpdater = createMockStatusUpdater();
      await handler({ prompt: "Test", model: "flash" }, statusUpdater);

      const calls = statusUpdater.getCalls();
      const generatingCall = calls.find((c) => c.message === "Generating Text");
      assertOk(
        generatingCall !== undefined,
        "Should show 'Generating Text' status"
      );
    });

    it("uses custom status_update if provided", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_text");

      const statusUpdater = createMockStatusUpdater();
      await handler(
        { prompt: "Test", model: "flash", status_update: "Custom Status" },
        statusUpdater
      );

      const calls = statusUpdater.getCalls();
      const customCall = calls.find((c) => c.message === "Custom Status");
      assertOk(customCall !== undefined, "Should use custom status");
    });
  });
});
