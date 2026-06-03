/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { deepStrictEqual, ok as assert } from "node:assert";
import { getGenerateFunctionGroup } from "../../../src/a2/agent/functions/generate.js";
import { createTestArgs } from "./generate-test-utils.js";
import type { RuntimeFlags, RuntimeFlagManager } from "@breadboard-ai/types";
import type { A2ModuleArgs } from "../../../src/a2/runnable-module-factory.js";

describe("getGenerateFunctionGroup", () => {
  describe("function definitions", () => {
    it("returns all six functions by default (generate_html excluded)", () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      assert(
        functionNames.includes("generate_images"),
        "Should include generate_images"
      );
      assert(
        functionNames.includes("generate_text"),
        "Should include generate_text"
      );
      assert(
        functionNames.includes("generate_video"),
        "Should include generate_video"
      );
      assert(
        functionNames.includes("generate_speech_from_text"),
        "Should include generate_speech_from_text"
      );
      assert(
        functionNames.includes("generate_music_from_text"),
        "Should include generate_music_from_text"
      );
      assert(
        functionNames.includes("generate_and_execute_code"),
        "Should include generate_and_execute_code"
      );
      assert(
        !functionNames.includes("generate_html"),
        "Should NOT include generate_html"
      );
      deepStrictEqual(functionNames.length, 6);
    });

    it("returns seven functions (including generate_html) when enableGenerateHtml is enabled", () => {
      const runtimeFlags = {
        enableGenerateHtml: true,
      } as unknown as RuntimeFlags;

      const args = createTestArgs({
        runtimeFlags,
        moduleArgs: {
          context: {
            flags: {
              flags: async () => runtimeFlags,
            } as unknown as RuntimeFlagManager,
          },
        } as unknown as A2ModuleArgs,
      });

      const group = getGenerateFunctionGroup(args);
      const functionNames = group.definitions.map(([name]) => name);

      assert(
        functionNames.includes("generate_html"),
        "Should include generate_html"
      );
      deepStrictEqual(functionNames.length, 7);
    });
  });

  describe("instruction", () => {
    it("includes instruction text in the group", () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);

      assert(group.instruction !== undefined, "Should have instruction");
      assert(
        group.instruction!.includes("generate_text"),
        "Instruction should mention generate_text"
      );
      assert(
        group.instruction!.includes("generate_and_execute_code"),
        "Instruction should mention generate_and_execute_code"
      );
    });

    it("excludes generate_html instruction by default or when enableGenerateHtml is disabled", () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);

      assert(group.instruction !== undefined, "Should have instruction");
      assert(
        !group.instruction!.includes("generate_html"),
        "Instruction should not mention generate_html"
      );
    });

    it("includes generate_html instruction when enableGenerateHtml is enabled", () => {
      const runtimeFlags = {
        enableGenerateHtml: true,
      } as unknown as RuntimeFlags;

      const args = createTestArgs({ runtimeFlags });
      const group = getGenerateFunctionGroup(args);

      assert(group.instruction !== undefined, "Should have instruction");
      assert(
        group.instruction!.includes("generate_html"),
        "Instruction should mention generate_html"
      );
    });
  });

  describe("declarations", () => {
    it("generates FunctionDeclarations for all functions", () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);

      deepStrictEqual(
        group.declarations.length,
        group.definitions.length,
        "Should have matching declarations and definitions"
      );
    });

    it("each declaration has name and description", () => {
      const args = createTestArgs();
      const group = getGenerateFunctionGroup(args);

      for (const decl of group.declarations) {
        assert(decl.name !== undefined, "Declaration should have name");
        assert(
          decl.description !== undefined,
          `Declaration ${decl.name} should have description`
        );
      }
    });
  });
});
