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

describe("generate_images", () => {
  describe("model selection", () => {
    it("uses flash image model when model='flash'", async () => {
      let capturedModel = "";
      const generators = createMockGenerators({
        callImage: mock.fn(async (_moduleArgs: unknown, model: string) => {
          capturedModel = model;
          return fixtures.imageSuccess;
        }) as unknown as Generators["callImage"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      await handler(
        { prompt: "A cat", model: "flash", images: [], aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      assertOk(
        capturedModel.includes("flash"),
        `Expected flash image model, got: ${capturedModel}`
      );
    });

    it("uses pro image model when model='pro'", async () => {
      let capturedModel = "";
      const generators = createMockGenerators({
        callImage: mock.fn(async (_moduleArgs: unknown, model: string) => {
          capturedModel = model;
          return fixtures.imageSuccess;
        }) as unknown as Generators["callImage"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      await handler(
        { prompt: "A cat", model: "pro", images: [], aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      assertOk(
        capturedModel.includes("pro"),
        `Expected pro image model, got: ${capturedModel}`
      );
    });
  });

  describe("multi-image naming", () => {
    it("adds index suffix for multiple images", async () => {
      const addedNames: string[] = [];
      const fileSystem = createMockFileSystem({
        add: mock.fn((_part: DataPart, name?: string) => {
          addedNames.push(name ?? "unnamed");
          return `/mnt/${name ?? "file"}`;
        }),
      });

      const generators = createMockGenerators({
        callImage: mock.fn(
          async () => fixtures.multiImageSuccess
        ) as unknown as Generators["callImage"],
      });

      const args = createTestArgs({ fileSystem, generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      await handler(
        {
          prompt: "Two cats",
          model: "flash",
          images: [],
          aspect_ratio: "16:9",
          file_name: "cat",
        },
        createMockStatusUpdater()
      );

      deepStrictEqual(addedNames, ["cat_1", "cat_2"]);
    });

    it("does not add suffix for single image", async () => {
      const addedNames: string[] = [];
      const fileSystem = createMockFileSystem({
        add: mock.fn((_part: DataPart, name?: string) => {
          addedNames.push(name ?? "unnamed");
          return `/mnt/${name ?? "file"}`;
        }),
      });

      const generators = createMockGenerators({
        callImage: mock.fn(
          async () => fixtures.imageSuccess
        ) as unknown as Generators["callImage"],
      });

      const args = createTestArgs({ fileSystem, generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      await handler(
        {
          prompt: "One cat",
          model: "flash",
          images: [],
          aspect_ratio: "16:9",
          file_name: "cat",
        },
        createMockStatusUpdater()
      );

      deepStrictEqual(addedNames, ["cat"]);
    });
  });

  describe("status updates", () => {
    it("shows 'Generating Image(s)' with expectedDuration=50", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      const statusUpdater = createMockStatusUpdater();
      await handler(
        { prompt: "A cat", model: "flash", images: [], aspect_ratio: "16:9" },
        statusUpdater
      );

      const calls = statusUpdater.getCalls();
      const imageCall = calls.find((c) => c.message === "Generating Image(s)");
      assertOk(
        imageCall !== undefined,
        "Should show 'Generating Image(s)' status"
      );
      deepStrictEqual(imageCall.options?.expectedDurationInSec, 50);
    });
  });

  describe("input/output handling", () => {
    it("passes input images through fileSystem.getMany", async () => {
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
      const handler = getHandler(group, "generate_images");

      await handler(
        {
          prompt: "Edit this",
          model: "flash",
          images: ["/mnt/input1.png", "/mnt/input2.png"],
          aspect_ratio: "16:9",
        },
        createMockStatusUpdater()
      );

      deepStrictEqual(capturedPaths, ["/mnt/input1.png", "/mnt/input2.png"]);
    });

    it("returns file paths for generated images", async () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      const result = await handler(
        { prompt: "A cat", model: "flash", images: [], aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      if (!isSuccess(result)) {
        fail(
          `Expected success, got error: ${(result as { error: string }).error}`
        );
      }
      const successResult = result as { images?: string[] };
      assertOk(successResult.images !== undefined, "Should have images result");
      assertOk(
        successResult.images.length > 0,
        "Should have at least one image"
      );
      assertOk(
        successResult.images[0].startsWith("/mnt/"),
        "Images should be file paths"
      );
    });
  });

  describe("error handling", () => {
    it("propagates callImage errors", async () => {
      const generators = createMockGenerators({
        callImage: mock.fn(async () =>
          err("Image generation failed")
        ) as unknown as Generators["callImage"],
      });

      const args = createTestArgs({ generators });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      const result = await handler(
        { prompt: "A cat", model: "flash", images: [], aspect_ratio: "16:9" },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual(
        (result as { error: string }).error,
        "Image generation failed"
      );
    });

    it("propagates fileSystem.getMany errors", async () => {
      const fileSystem = createMockFileSystem({
        getMany: mock.fn(async () =>
          err("File not found")
        ) as unknown as ReturnType<typeof createMockFileSystem>["getMany"],
      });

      const args = createTestArgs({ fileSystem });
      const group = getGenerateFunctionGroup(args);
      const handler = getHandler(group, "generate_images");

      const result = await handler(
        {
          prompt: "Edit this",
          model: "flash",
          images: ["/mnt/missing.png"],
          aspect_ratio: "16:9",
        },
        createMockStatusUpdater()
      );

      assertOk(!isSuccess(result), "Should return error");
      deepStrictEqual((result as { error: string }).error, "File not found");
    });
  });
});
