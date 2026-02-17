/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { deepStrictEqual, ok as assert } from "node:assert";
import { getGenerateFunctionGroup } from "../../../src/a2/agent/functions/generate.js";
import { createTestArgs } from "./generate-test-utils.js";

describe("getGenerateFunctionGroup", () => {
  describe("function definitions", () => {
    it("returns all six functions", () => {
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
