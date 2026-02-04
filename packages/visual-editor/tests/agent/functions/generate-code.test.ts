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
import type { DataPart } from "@breadboard-ai/types";
import {
  createMockGenerators,
  createStreamResponse,
  createTestArgs,
  createMockStatusUpdater,
  createMockFileSystem,
  createMockTranslator,
  createCandidate,
  getHandler,
  fixtures,
} from "./generate-test-utils.js";

/**
 * Helper to check if result is a success (no error property).
 */
function isSuccess(result: unknown): boolean {
  return !(result && typeof result === "object" && "error" in result);
}

describe("generate_and_execute_code", () => {
  describe("code execution tool", () => {
    it("always adds codeExecution tool", async () => {
      let capturedBody: GeminiBody | undefined;
      const generators = createMockGenerators({
        conformBody: mock.fn(async (_moduleArgs: unknown, body: GeminiBody) => {
          capturedBody = body;
          return body;
        }) as unknown as Generators["conformBody"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      await handler({ prompt: "Calculate 2+2" }, createMockStatusUpdater());

      assertOk(capturedBody !== undefined, "Body should be captured");
      assertOk(capturedBody.tools !== undefined, "Tools should be defined");
      const hasCodeExec = capturedBody.tools.some(
        (t: Tool) => "codeExecution" in t
      );
      assertOk(hasCodeExec, "Should include codeExecution tool");
    });
  });

  describe("search grounding", () => {
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
      const handler = getHandler(group, "generate_and_execute_code");

      await handler(
        { prompt: "Research and calculate", search_grounding: true },
        createMockStatusUpdater()
      );

      assertOk(capturedBody !== undefined, "Body should be captured");
      assertOk(capturedBody.tools !== undefined, "Tools should be defined");
      const hasGoogleSearch = capturedBody.tools.some(
        (t: Tool) => "googleSearch" in t
      );
      assertOk(hasGoogleSearch, "Should include googleSearch tool");
    });
  });

  describe("inline data parts", () => {
    it("converts inline data to file tags", async () => {
      const streamWithInlineData: GeminiAPIOutputs[] = [
        {
          candidates: [
            createCandidate([
              { text: "Here is your result:" },
              { inlineData: { mimeType: "image/png", data: "base64data" } },
            ]),
          ],
        },
      ];

      const fileSystem = createMockFileSystem({
        add: mock.fn((_part: DataPart) => "/vfs/output.png"),
      });

      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          createStreamResponse(streamWithInlineData)
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ fileSystem, generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      const result = await handler(
        { prompt: "Generate a chart" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { result?: string };
      assertOk(successResult.result !== undefined, "Should have result");
      assertOk(
        successResult.result.includes('<file src="/vfs/output.png"'),
        `Should include file tag, got: ${successResult.result}`
      );
    });
  });

  describe("code execution result", () => {
    it("handles successful code execution", async () => {
      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          createStreamResponse([fixtures.codeExecutionSuccess])
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      const result = await handler(
        { prompt: "Calculate 2+2" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { result?: string };
      assertOk(successResult.result !== undefined, "Should have result");
    });

    it("returns error for failed code execution", async () => {
      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          createStreamResponse([fixtures.codeExecutionError])
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      const result = await handler(
        { prompt: "Run broken code" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      const errorMsg = (result as { error: string }).error;
      assertOk(
        errorMsg.includes("code generator tried and failed") ||
          errorMsg.includes("SyntaxError"),
        `Should contain execution error, got: ${errorMsg}`
      );
    });
  });

  describe("status updates", () => {
    it("shows 'Researching' when search_grounding enabled", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      const statusUpdater = createMockStatusUpdater();
      await handler(
        { prompt: "Research something", search_grounding: true },
        statusUpdater
      );

      const calls = statusUpdater.getCalls();
      const researchingCall = calls.find((c) => c.message === "Researching");
      assertOk(
        researchingCall !== undefined,
        "Should show 'Researching' status"
      );
    });

    it("shows 'Generating Code' when no grounding", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      const statusUpdater = createMockStatusUpdater();
      await handler({ prompt: "Calculate something" }, statusUpdater);

      const calls = statusUpdater.getCalls();
      const generatingCall = calls.find((c) => c.message === "Generating Code");
      assertOk(
        generatingCall !== undefined,
        "Should show 'Generating Code' status"
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
      const handler = getHandler(group, "generate_and_execute_code");

      const result = await handler(
        { prompt: "Test" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "Translation failed"
      );
    });

    it("propagates stream errors", async () => {
      const generators = createMockGenerators({
        streamContent: mock.fn(async () =>
          err("Stream failed")
        ) as unknown as Generators["streamContent"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_and_execute_code");

      const result = await handler(
        { prompt: "Test" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual((result as { error: string }).error, "Stream failed");
    });
  });
});
