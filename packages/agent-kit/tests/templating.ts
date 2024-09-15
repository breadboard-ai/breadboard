/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { substitute } from "../src/future/templating.js";
import { InlineDataCapabilityPart, LLMContent } from "@google-labs/breadboard";
import { deepStrictEqual } from "node:assert";

describe("Templating", () => {
  it("does simple substitution", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = "wizard";
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": "Harry",
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("You're a wizard, Harry."),
      task: llmContent("Act like a wizard."),
    });
  });

  it("does simple LLM Content object substitution", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = llmContent("wizard");
    const name = llmContent("Harry");
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("You're a wizard, Harry."),
      task: llmContent("Act like a wizard."),
    });
  });

  it("does part-splicing LLM Content object substitution", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = llmContent("wizard");
    const name = llmContent("Harry", " ", "Potter");
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("You're a wizard, Harry Potter."),
      task: llmContent("Act like a wizard."),
    });
  });

  it("works with LLM Content Array arguments", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = [llmContent("wizard")];
    const name = [llmContent("Harry", " ", "Potter")];
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("You're a wizard, Harry Potter."),
      task: llmContent("Act like a wizard."),
    });
  });

  it("works with other primitive types", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = true;
    const name = 42;
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("You're a true, 42."),
      task: llmContent("Act like a true."),
    });
  });

  it("works with arbitrary objects", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = { wizard: true };
    const name = "Harry";
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent('You\'re a {"wizard":true}, Harry.'),
      task: llmContent('Act like a {"wizard":true}.'),
    });
  });

  it("works with other part types", async () => {
    const context: LLMContent[] = [];
    const persona = llmContent("You're a {{character}}, {{name}}.");
    const task = llmContent("Act like a {{character}}.");
    const character = llmContent("wizard");
    const name = llmContent("Harry", inlineData("potter", "text/plain"));
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent(
        "You're a wizard, Harry",
        inlineData("potter", "text/plain"),
        "."
      ),
      task: llmContent("Act like a wizard."),
    });
  });
});

function inlineData(data: string, mimeType: string): InlineDataCapabilityPart {
  return {
    inlineData: {
      data,
      mimeType,
    },
  };
}

function llmContent(
  ...text: (string | InlineDataCapabilityPart)[]
): LLMContent {
  return {
    parts: text.map((t) => {
      if (typeof t === "string") {
        return { text: t };
      }
      return t;
    }),
  };
}
