/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePrompt,
  buildPrompt,
  extractPromptText,
  extractInPorts,
} from "../../src/utils/prompt-utils.js";
import type { TemplatePart } from "@breadboard-ai/utils";

describe("prompt-utils", () => {
  describe("parsePrompt", () => {
    it("splits raw prompt into objective text and tools", () => {
      const tool1: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const tool2: TemplatePart = {
        type: "tool",
        path: "tool-2",
        title: "Tool 2",
      };
      const raw = `Solve the objective.
{${JSON.stringify(tool1)}}
{${JSON.stringify(tool2)}}`;

      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(objectiveText, "Solve the objective.");
      assert.deepEqual(tools, [tool1, tool2]);
    });

    it("preserves non-tool placeholders in objective text", () => {
      const inPort: TemplatePart = {
        type: "in",
        path: "input-val",
        title: "Input Val",
      };
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const raw = `Use input {${JSON.stringify(inPort)}} to run {${JSON.stringify(tool)}}`;

      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(
        objectiveText,
        `Use input {${JSON.stringify(inPort)}} to run`
      );
      assert.deepEqual(tools, [tool]);
    });

    it("handles legacy prompts with tools interspersed", () => {
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const raw = `Before {${JSON.stringify(tool)}} After`;

      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(objectiveText, "Before  After");
      assert.deepEqual(tools, [tool]);
    });

    it("handles prompts with no tools", () => {
      const raw = "Plain objective text";
      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(objectiveText, "Plain objective text");
      assert.deepEqual(tools, []);
    });

    it("handles invalid JSON placeholders gracefully", () => {
      const raw = "Objective with invalid placeholder {{invalid-json}}";
      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(
        objectiveText,
        "Objective with invalid placeholder {{invalid-json}}"
      );
      assert.deepEqual(tools, []);
    });
  });

  describe("buildPrompt", () => {
    it("appends tool placeholders at the end of the prompt", () => {
      const objectiveText = "Solve the objective.";
      const tools: TemplatePart[] = [
        { type: "tool", path: "tool-1", title: "Tool 1" },
      ];

      const prompt = buildPrompt(objectiveText, tools);

      assert.strictEqual(
        prompt,
        `Solve the objective.\n{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`
      );
    });

    it("returns tools only if objective text is empty", () => {
      const objectiveText = "";
      const tools: TemplatePart[] = [
        { type: "tool", path: "tool-1", title: "Tool 1" },
      ];

      const prompt = buildPrompt(objectiveText, tools);

      assert.strictEqual(
        prompt,
        `{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`
      );
    });

    it("returns objective text only if tools list is empty", () => {
      const objectiveText = "Solve the objective.";
      const tools: TemplatePart[] = [];

      const prompt = buildPrompt(objectiveText, tools);

      assert.strictEqual(prompt, "Solve the objective.");
    });
  });

  describe("extractPromptText", () => {
    it("extracts text from user parts in LLMContent value", () => {
      const config = {
        role: "user",
        parts: [{ text: "Objective text" }],
      };

      assert.strictEqual(extractPromptText(config), "Objective text");
    });

    it("returns empty string for invalid prompt values", () => {
      assert.strictEqual(extractPromptText(null), "");
      assert.strictEqual(extractPromptText(undefined), "");
      assert.strictEqual(extractPromptText("plain text"), "");
      assert.strictEqual(extractPromptText({ parts: [] }), "");
    });
  });

  describe("extractInPorts", () => {
    it("extracts inport references from prompt string", () => {
      const inPort: TemplatePart = {
        type: "in",
        path: "input-val",
        title: "Input Val",
      };
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const prompt = `Use input {${JSON.stringify(inPort)}} and tool {${JSON.stringify(tool)}}`;

      const ins = extractInPorts(prompt);

      assert.deepEqual(ins, [{ path: "input-val", title: "Input Val" }]);
    });

    it("returns empty array when no inports are present", () => {
      assert.deepEqual(extractInPorts("Plain prompt without inports"), []);
    });
  });
});
