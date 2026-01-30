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
  describe("constraint filtering", () => {
    it("returns all functions when constraint='none'", () => {
      const args = createTestArgs({ modelConstraint: "none" });
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

    it("returns only image function when constraint='image'", () => {
      const args = createTestArgs({ modelConstraint: "image" });
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      deepStrictEqual(functionNames, ["generate_images"]);
    });

    it("returns only video function when constraint='video'", () => {
      const args = createTestArgs({ modelConstraint: "video" });
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      deepStrictEqual(functionNames, ["generate_video"]);
    });

    it("returns only speech function when constraint='speech'", () => {
      const args = createTestArgs({ modelConstraint: "speech" });
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      deepStrictEqual(functionNames, ["generate_speech_from_text"]);
    });

    it("returns only music function when constraint='music'", () => {
      const args = createTestArgs({ modelConstraint: "music" });
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      deepStrictEqual(functionNames, ["generate_music_from_text"]);
    });

    it("returns all functions when constraint='text-flash'", () => {
      const args = createTestArgs({ modelConstraint: "text-flash" });
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      // text-flash falls through to default case which returns all
      assert(functionNames.length === 6, "Should return all 6 functions");
    });

    it("returns all functions when constraint='text-pro'", () => {
      const args = createTestArgs({ modelConstraint: "text-pro" });
      const group = getGenerateFunctionGroup(args);

      const functionNames = group.definitions.map(([name]) => name);
      // text-pro falls through to default case which returns all
      assert(functionNames.length === 6, "Should return all 6 functions");
    });
  });

  describe("instruction", () => {
    it("includes instruction text in the group", () => {
      const args = createTestArgs({ modelConstraint: "none" });
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
      const args = createTestArgs({ modelConstraint: "none" });
      const group = getGenerateFunctionGroup(args);

      deepStrictEqual(
        group.declarations.length,
        group.definitions.length,
        "Should have matching declarations and definitions"
      );
    });

    it("each declaration has name and description", () => {
      const args = createTestArgs({ modelConstraint: "none" });
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
