/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createThemeGenerationPrompt,
  getThemeFromIntentGenerationPrompt,
} from "../../../src/ui/prompts/theme-generation.js";

describe("getThemeFromIntentGenerationPrompt", () => {
  it("returns LLMContent with a single text part", () => {
    const result = getThemeFromIntentGenerationPrompt("Build a recipe finder");
    assert.ok(result.parts);
    assert.equal(result.parts.length, 1);
    assert.ok("text" in result.parts[0]);
  });

  it("embeds the intent in the output text", () => {
    const result = getThemeFromIntentGenerationPrompt("Build a recipe finder");
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(text.includes("Build a recipe finder"));
  });

  it("includes the intent within <intent> tags", () => {
    const result = getThemeFromIntentGenerationPrompt("my app intent");
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(text.includes("<intent>"));
    assert.ok(text.includes("my app intent"));
    assert.ok(text.includes("</intent>"));
  });
});

describe("createThemeGenerationPrompt", () => {
  it("returns LLMContent with a single text part", () => {
    const result = createThemeGenerationPrompt({
      random: false,
      title: "My App",
      description: "A test application",
    });
    assert.ok(result.parts);
    assert.equal(result.parts.length, 1);
    assert.ok("text" in result.parts[0]);
  });

  it("embeds the title and description in normal mode", () => {
    const result = createThemeGenerationPrompt({
      random: false,
      title: "Recipe Finder",
      description: "Finds recipes for you",
    });
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(text.includes("Recipe Finder"));
    assert.ok(text.includes("Finds recipes for you"));
  });

  it("overrides title and description in random mode", () => {
    const result = createThemeGenerationPrompt({
      random: true,
      title: "This should be ignored",
      description: "Also ignored",
    });
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(text.includes("Random application"));
    assert.ok(!text.includes("This should be ignored"));
    assert.ok(!text.includes("Also ignored"));
  });

  it("includes user instruction when provided", () => {
    const result = createThemeGenerationPrompt({
      random: false,
      title: "My App",
      description: "A test app",
      userInstruction: "Use a blue ocean theme",
    });
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(text.includes("Use a blue ocean theme"));
    assert.ok(text.includes("User's stylistic instructions"));
  });

  it("does not include stylistic instructions section when no user instruction", () => {
    const result = createThemeGenerationPrompt({
      random: false,
      title: "My App",
    });
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(!text.includes("User's stylistic instructions"));
  });

  it("handles missing description gracefully", () => {
    const result = createThemeGenerationPrompt({
      random: false,
      title: "No Desc App",
    });
    const text = (result.parts[0] as { text: string }).text;
    assert.ok(text.includes("No Desc App"));
    // Description part should be empty string, not "undefined"
    assert.ok(!text.includes("undefined"));
  });
});
