/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { InlineDataCapabilityPart } from "@google-labs/breadboard";
import { deepStrictEqual } from "node:assert";
import {
  describeSpecialist,
  substitute,
  content,
  describeContent,
} from "../src/templating.js";
import { LlmContent } from "../src/context.js";

describe("Templating", () => {
  it("does simple substitution", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
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
      persona: llmContent("user", "You're a wizard, Harry."),
      task: llmContent("user", "Act like a wizard."),
      outs: [],
    });
  });

  it("does simple substitution with whitespaces in params", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{ character}}, {{ name }}.");
    const task = llmContent("user", "Act like a {{character     }}.");
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
      persona: llmContent("user", "You're a wizard, Harry."),
      task: llmContent("user", "Act like a wizard."),
      outs: [],
    });
  });

  it("does simple substitution with op and arg", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent(
      "user",
      "You're a {{ character | out }}, {{ name | in }}."
    );
    const task = llmContent("user", 'Act like a {{character | out: "test" }}.');
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
      persona: llmContent("user", 'You\'re a "TOOL_CHARACTER", Harry.'),
      task: llmContent("user", 'Act like a "TOOL_CHARACTER".'),
      outs: [
        {
          name: "character",
          description:
            'Call this function when asked to invoke the "TOOL_CHARACTER" tool.',
        },
      ],
    });
  });

  it("does simple LLM Content object substitution", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
    const character = llmContent("user", "wizard");
    const name = llmContent("user", "Harry");
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("user", "You're a wizard, Harry."),
      task: llmContent("user", "Act like a wizard."),
      outs: [],
    });
  });

  it("does part-splicing LLM Content object substitution", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
    const character = llmContent("user", "wizard");
    const name = llmContent("user", "Harry", " ", "Potter");
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("user", "You're a wizard, Harry Potter."),
      task: llmContent("user", "Act like a wizard."),
      outs: [],
    });
  });

  it("works with LLM Content Array arguments", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
    const character = [llmContent("user", "wizard")];
    const name = [llmContent("user", "Harry", " ", "Potter")];
    const result = substitute({
      in: context,
      persona,
      task,
      "p-character": character,
      "p-name": name,
    });
    deepStrictEqual(result, {
      in: [],
      persona: llmContent("user", "You're a wizard, Harry Potter."),
      task: llmContent("user", "Act like a wizard."),
      outs: [],
    });
  });

  it("works with other primitive types", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
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
      persona: llmContent("user", "You're a true, 42."),
      task: llmContent("user", "Act like a true."),
      outs: [],
    });
  });

  it("works with arbitrary objects", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
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
      persona: llmContent("user", 'You\'re a {"wizard":true}, Harry.'),
      task: llmContent("user", 'Act like a {"wizard":true}.'),
      outs: [],
    });
  });

  it("works with other part types", async () => {
    const context: LlmContent[] = [];
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");
    const character = llmContent("user", "wizard");
    const name = llmContent(
      "user",
      "Harry",
      inlineData("potter", "text/plain")
    );
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
        "user",
        "You're a wizard, Harry",
        inlineData("potter", "text/plain"),
        "."
      ),
      task: llmContent("user", "Act like a wizard."),
      outs: [],
    });
  });
});

describe("Content component", () => {
  it("does simple forwarding of content", () => {
    const context = [llmContent("user", "You're a wizard, Harry.")];
    const template = llmContent("user");
    const result = content({ context, template });
    deepStrictEqual(result, {
      context: [llmContent("user", "You're a wizard, Harry.")],
    });
  });

  it("correcly elides empty context", () => {
    const context: LlmContent[] = [];
    const template = llmContent("user", "You're a wizard, Harry.");
    const result = content({ context, template });
    deepStrictEqual(result, {
      context: [llmContent("user", "You're a wizard, Harry.")],
    });
  });

  it("handles empty template", () => {
    const context = [llmContent("user", "You're a wizard, Harry.")];
    const template = undefined;
    const result = content({ context, template });
    deepStrictEqual(result, {
      context: [llmContent("user", "You're a wizard, Harry.")],
    });
  });

  it("does simple substitution", () => {
    const context: LlmContent[] = [];
    const template = llmContent("user", "Act like a {{role}}.");
    const role = "wizard";
    const result = content({ context, template, "p-role": role });
    deepStrictEqual(result, {
      context: [llmContent("user", "Act like a wizard.")],
    });
  });

  it("does simple LLM Content object substitution", () => {
    const context: LlmContent[] = [];
    const template = llmContent("user", "Act like a {{role}}.");
    const role = llmContent("user", "wizard");
    const result = content({ context, template, "p-role": role });
    deepStrictEqual(result, {
      context: [llmContent("user", "Act like a wizard.")],
    });
  });

  it("correctly prepends context", () => {
    const context = [llmContent("model", "You're a wizard, Harry.")];
    const template = llmContent("user", "Act like a {{role}}.");
    const role = llmContent("user", "wizard");
    const result = content({ context, template, "p-role": role });
    deepStrictEqual(result, {
      context: [
        llmContent("model", "You're a wizard, Harry."),
        llmContent("user", "Act like a wizard."),
      ],
    });
  });

  it("correctly merges with context in user role", () => {
    const context = [llmContent("user", "You're a wizard, Harry.")];
    const template = llmContent("user", "Act like a {{role}}.");
    const role = llmContent("user", "wizard");
    const result = content({ context, template, "p-role": role });
    deepStrictEqual(result, {
      context: [
        llmContent("user", "You're a wizard, Harry.", "Act like a wizard."),
      ],
    });
  });
});

describe("Specialist v2 describer", () => {
  it("correctly collects parameters", () => {
    const $inputSchema = {};
    const $outputSchema = {};
    const persona = llmContent("user", "You're a {{character}}, {{name}}.");
    const task = llmContent("user", "Act like a {{character}}.");

    const result = describeSpecialist({
      $inputSchema,
      $outputSchema,
      persona,
      task,
    });

    const paramProps = result.inputSchema.properties;
    delete paramProps.in;
    delete paramProps.persona;
    delete paramProps.task;
    deepStrictEqual(paramProps, {
      "p-character": {
        description: 'The value to substitute for the parameter "character"',
        title: "Character",
        type: "string",
      },
      "p-name": {
        description: 'The value to substitute for the parameter "name"',
        title: "Name",
        type: "string",
      },
    });
  });

  it("handles whitespace in parameter names", () => {
    const $inputSchema = {};
    const $outputSchema = {};
    const persona = llmContent("user", "You're a {{ character}}, {{ name }}.");
    const task = llmContent("user", "Act like a {{character }}.");

    const result = describeSpecialist({
      $inputSchema,
      $outputSchema,
      persona,
      task,
    });

    const paramProps = result.inputSchema.properties;
    delete paramProps.in;
    delete paramProps.persona;
    delete paramProps.task;
    deepStrictEqual(paramProps, {
      "p-character": {
        description: 'The value to substitute for the parameter "character"',
        title: "Character",
        type: "string",
      },
      "p-name": {
        description: 'The value to substitute for the parameter "name"',
        title: "Name",
        type: "string",
      },
    });
  });
});

describe("Content describer", () => {
  it("works without params", () => {
    const $inputSchema = {};
    const $outputSchema = {};
    const template = llmContent("user", "Act like a wizard.");

    const result = describeContent({
      $inputSchema,
      $outputSchema,
      template,
    });

    const paramProps = result.inputSchema.properties;
    delete paramProps.context;
    delete paramProps.template;

    deepStrictEqual(paramProps, {});
  });

  it("correctly collects parameters", () => {
    const $inputSchema = {};
    const $outputSchema = {};
    const template = llmContent("user", "Act like a {{role}}.");

    const result = describeContent({
      $inputSchema,
      $outputSchema,
      template,
    });

    const paramProps = result.inputSchema.properties;
    delete paramProps.context;
    delete paramProps.template;
    deepStrictEqual(paramProps, {
      "p-role": {
        description: 'The value to substitute for the parameter "role"',
        title: "Role",
        type: "string",
      },
    });
  });

  it("handles whitespace in parameter names", () => {
    const $inputSchema = {};
    const $outputSchema = {};
    const template = llmContent("user", "Act like a {{ role  }}.");

    const result = describeContent({
      $inputSchema,
      $outputSchema,
      template,
    });

    const paramProps = result.inputSchema.properties;
    delete paramProps.context;
    delete paramProps.template;
    deepStrictEqual(paramProps, {
      "p-role": {
        description: 'The value to substitute for the parameter "role"',
        title: "Role",
        type: "string",
      },
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
  role: "user" | "model",
  ...text: (string | InlineDataCapabilityPart)[]
): LlmContent {
  if (text.length === 0) {
    return { parts: [{ text: "" }], role };
  }
  return {
    role,
    parts: text.map((t) => {
      if (typeof t === "string") {
        return { text: t };
      }
      return t;
    }),
  } as LlmContent;
}
