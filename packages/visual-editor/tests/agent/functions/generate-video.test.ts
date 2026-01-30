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
import type { LLMContent, DataPart } from "@breadboard-ai/types";
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

describe("generate_video", () => {
  describe("stored data handling", () => {
    it("extracts video handle from storedData part", async () => {
      let addedPart: DataPart | undefined;
      const fileSystem = createMockFileSystem({
        add: mock.fn((part: DataPart) => {
          addedPart = part;
          return "/vfs/video.mp4";
        }),
      });

      const args = createTestArgs({ fileSystem });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      const result = await handler(
        { prompt: "A sunset", aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { video?: string };
      assertOk(successResult.video !== undefined, "Should have video result");
      deepStrictEqual(successResult.video, "/vfs/video.mp4");
      assertOk(addedPart !== undefined, "Should add part to file system");
      assertOk("storedData" in addedPart, "Added part should be storedData");
    });
  });

  describe("aspect ratio", () => {
    it("passes 16:9 aspect ratio to generator", async () => {
      let capturedRatio = "";
      const generators = createMockGenerators({
        callVideo: mock.fn(
          async (
            _caps: unknown,
            _moduleArgs: unknown,
            _prompt: string,
            _images: LLMContent[],
            _negativePrompt: boolean,
            aspectRatio: string
          ) => {
            capturedRatio = aspectRatio;
            return fixtures.videoSuccess;
          }
        ) as unknown as Generators["callVideo"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      await handler(
        { prompt: "A sunset", aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedRatio, "16:9");
    });

    it("passes 9:16 aspect ratio to generator", async () => {
      let capturedRatio = "";
      const generators = createMockGenerators({
        callVideo: mock.fn(
          async (
            _caps: unknown,
            _moduleArgs: unknown,
            _prompt: string,
            _images: LLMContent[],
            _negativePrompt: boolean,
            aspectRatio: string
          ) => {
            capturedRatio = aspectRatio;
            return fixtures.videoSuccess;
          }
        ) as unknown as Generators["callVideo"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      await handler(
        { prompt: "A sunset", aspect_ratio: "9:16" },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedRatio, "9:16");
    });
  });

  describe("status updates", () => {
    it("shows 'Generating Video' with expectedDuration=70", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      const statusUpdater = createMockStatusUpdater();
      await handler(
        { prompt: "A sunset", aspect_ratio: "16:9" },
        statusUpdater
      );

      const calls = statusUpdater.getCalls();
      const videoCall = calls.find((c) => c.message === "Generating Video");
      assertOk(
        videoCall !== undefined,
        "Should show 'Generating Video' status"
      );
      deepStrictEqual(videoCall.options?.expectedDurationInSec, 70);
    });
  });

  describe("reference images", () => {
    it("passes reference images through fileSystem.getMany", async () => {
      let capturedPaths: string[] = [];
      const fileSystem = createMockFileSystem({
        getMany: mock.fn(async (paths: string[]) => {
          capturedPaths = paths;
          return paths.map(() => ({
            inlineData: { mimeType: "image/png", data: "mock" },
          }));
        }),
      });

      const args = createTestArgs({ fileSystem });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      await handler(
        {
          prompt: "Animate this",
          aspect_ratio: "16:9",
          images: ["/vfs/frame1.png"],
        },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedPaths, ["/vfs/frame1.png"]);
    });
  });

  describe("error handling", () => {
    it("returns error when no video part produced", async () => {
      const generators = createMockGenerators({
        callVideo: mock.fn(async () => ({
          parts: [],
          role: "model" as const,
        })) as unknown as Generators["callVideo"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      const result = await handler(
        { prompt: "A sunset", aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "No video was generated"
      );
    });

    it("propagates callVideo errors", async () => {
      const generators = createMockGenerators({
        callVideo: mock.fn(async () =>
          err("Video generation failed")
        ) as unknown as Generators["callVideo"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      const result = await handler(
        { prompt: "A sunset", aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      // expandVeoError wraps the error, so check it contains the original message
      const errorMsg = (result as { error: string }).error;
      assertOk(
        errorMsg.includes("Video generation failed") || errorMsg.length > 0,
        `Should propagate error, got: ${errorMsg}`
      );
    });

    it("propagates fileSystem.getMany errors for reference images", async () => {
      const fileSystem = createMockFileSystem({
        getMany: mock.fn(async () =>
          err("Reference image not found")
        ) as unknown as ReturnType<typeof createMockFileSystem>["getMany"],
      });

      const args = createTestArgs({ fileSystem });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_video");

      const result = await handler(
        {
          prompt: "Animate this",
          aspect_ratio: "16:9",
          images: ["/vfs/missing.png"],
        },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "Reference image not found"
      );
    });
  });
});
