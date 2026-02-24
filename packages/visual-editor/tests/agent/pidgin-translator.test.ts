/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import {
  PidginTranslator,
  MAX_INLINE_CHARACTER_LENGTH,
} from "../../src/a2/agent/pidgin-translator.js";
import { stubMemoryManager, stubModuleArgs } from "../useful-stubs.js";
import { AgentFileSystem } from "../../src/a2/agent/file-system.js";
import {
  deepStrictEqual,
  fail,
  ok as assertOk,
  strictEqual,
} from "node:assert";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { Template } from "../../src/a2/a2/template.js";
import {
  ROUTE_TOOL_PATH,
  NOTEBOOKLM_TOOL_PATH,
} from "../../src/a2/a2/tool-manager.js";
import { llm } from "../../src/a2/a2/utils.js";
import { escapeHtml } from "../../src/utils/escape-html.js";
import { LLMContent } from "@breadboard-ai/types";

function makeTranslator(): PidginTranslator {
  const fileSystem = new AgentFileSystem({
    context: stubModuleArgs.context,
    memoryManager: stubMemoryManager,
  });
  return new PidginTranslator(stubModuleArgs, fileSystem);
}

function makeTranslatorWithFileSystem(): {
  translator: PidginTranslator;
  fileSystem: AgentFileSystem;
} {
  const fileSystem = new AgentFileSystem({
    context: stubModuleArgs.context,
    memoryManager: stubMemoryManager,
  });
  return {
    translator: new PidginTranslator(stubModuleArgs, fileSystem),
    fileSystem,
  };
}

describe("Pidgin Translator", () => {
  describe("toPidgin", () => {
    it("encodes HTML entities", async () => {
      const s = `<a href="foo">FOO</a>`;
      const translated = await makeTranslator().toPidgin(
        llm`${s}`.asContent(),
        {},
        false
      );
      if (!ok(translated)) {
        fail(translated.$error);
      }
      deepStrictEqual(translated.text, escapeHtml(s));
    });

    it("adds routes", async () => {
      const fileSystem = new AgentFileSystem({
        context: stubModuleArgs.context,
        memoryManager: stubMemoryManager,
      });
      const translator = new PidginTranslator(stubModuleArgs, fileSystem);

      const translated = await translator.toPidgin(
        llm`Go to ${Template.route("Route A", "cool-route")}`.asContent(),
        {},
        false
      );
      if (!ok(translated)) {
        fail(translated.$error);
      }
      const { text } = translated;
      deepStrictEqual(text, `Go to <a href="/route-1">Route A</a>`);
      const originalRoute = fileSystem.getOriginalRoute("/route-1");
      deepStrictEqual(originalRoute, "cool-route");
    });

    it("fails when adding malformed routes", async () => {
      const translated = await makeTranslator().toPidgin(
        llm`Go to ${Template.part({ type: "tool", title: "Route A", path: ROUTE_TOOL_PATH })}`.asContent(),
        {},
        false
      );
      if (ok(translated)) {
        fail(`No error when adding malformed route`);
      }
    });

    it("deduplicates storedData parts with same handle", async () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();

      const handle = "stored://same-handle-for-all";
      const content: LLMContent = {
        role: "user",
        parts: [
          { storedData: { handle, mimeType: "image/png" } },
          { storedData: { handle, mimeType: "image/png" } },
          { storedData: { handle, mimeType: "image/png" } },
        ],
      };

      const translated = await translator.toPidgin(content, {}, false);
      if (!ok(translated)) {
        fail(translated.$error);
      }

      // All three parts should reference the same file
      const matches = translated.text.match(/<file src="([^"]+)" \/>/g);
      strictEqual(matches?.length, 3);
      // All matches should be identical (same file reference)
      strictEqual(matches![0], matches![1]);
      strictEqual(matches![1], matches![2]);

      // Only one file should be stored
      strictEqual(fileSystem.files.size, 1);
    });

    it("deduplicates fileData parts with same URI", async () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();

      const fileUri = "https://example.com/same-file.pdf";
      const content: LLMContent = {
        role: "user",
        parts: [
          { fileData: { fileUri, mimeType: "application/pdf" } },
          { fileData: { fileUri, mimeType: "application/pdf" } },
        ],
      };

      const translated = await translator.toPidgin(content, {}, false);
      if (!ok(translated)) {
        fail(translated.$error);
      }

      // Both parts should reference the same file
      const matches = translated.text.match(/<file src="([^"]+)" \/>/g);
      strictEqual(matches?.length, 2);
      strictEqual(matches![0], matches![1]);

      // Only one file should be stored
      strictEqual(fileSystem.files.size, 1);
    });

    it("sets useNotebookLM when content has NLM tool placeholder", async () => {
      const translated = await makeTranslator().toPidgin(
        llm`Use ${Template.part({ type: "tool", title: "Use NotebookLM", path: NOTEBOOKLM_TOOL_PATH })}`.asContent(),
        {},
        false
      );
      if (!ok(translated)) {
        fail(translated.$error);
      }
      strictEqual(translated.useNotebookLM, true);
    });

    it("does not set useNotebookLM for non-NLM content", async () => {
      const translated = await makeTranslator().toPidgin(
        llm`Hello world`.asContent(),
        {},
        false
      );
      if (!ok(translated)) {
        fail(translated.$error);
      }
      strictEqual(translated.useNotebookLM, false);
    });

    it("passes NLM storedData through as text URL, not into file system", async () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();

      const handle = "https://notebooklm.google.com/notebook/abc123";
      const content: LLMContent = {
        role: "user",
        parts: [
          {
            storedData: {
              handle,
              mimeType: "application/x-notebooklm",
            },
          },
        ],
      };

      const translated = await translator.toPidgin(content, {}, false);
      if (!ok(translated)) {
        fail(translated.$error);
      }

      // The URL should appear as text, not as a <file> reference
      strictEqual(translated.text.includes(handle), true);
      strictEqual(translated.text.includes("<file"), false);

      // File system should not have stored anything
      strictEqual(fileSystem.files.size, 0);
    });
  });

  describe("contentToPidginString", () => {
    it("inlines short text without a file handle", () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();
      const shortText = "Hello, world!";
      const content: LLMContent = {
        parts: [{ text: shortText }],
      };

      const result = translator.contentToPidginString(content);

      strictEqual(result, shortText);
      strictEqual(fileSystem.files.size, 0);
    });

    it("wraps long text in <content> tags with a file handle", () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();
      const longText = "x".repeat(MAX_INLINE_CHARACTER_LENGTH + 1);
      const content: LLMContent = {
        parts: [{ text: longText }],
      };

      const result = translator.contentToPidginString(content);

      // Should contain both the file reference AND the inline text
      assertOk(result.includes("<content src="));
      assertOk(result.includes(longText));
      assertOk(result.includes("</content>"));
      // File should be stored
      strictEqual(fileSystem.files.size, 1);
    });

    it("does not wrap long text when textAsFiles is false", () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();
      const longText = "x".repeat(MAX_INLINE_CHARACTER_LENGTH + 1);
      const content: LLMContent = {
        parts: [{ text: longText }],
      };

      const result = translator.contentToPidginString(content, false);

      strictEqual(result, longText);
      strictEqual(fileSystem.files.size, 0);
    });

    it("converts storedData parts to <file> tags", () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();
      const content: LLMContent = {
        parts: [
          {
            storedData: { handle: "stored://my-image", mimeType: "image/png" },
          },
        ],
      };

      const result = translator.contentToPidginString(content);

      assertOk(result.includes('<file src="'));
      assertOk(result.includes('" />'));
      strictEqual(fileSystem.files.size, 1);
    });

    it("passes NotebookLM storedData through as URL text", () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();
      const handle = "https://notebooklm.google.com/notebook/abc123";
      const content: LLMContent = {
        parts: [
          {
            storedData: {
              handle,
              mimeType: "application/x-notebooklm",
            },
          },
        ],
      };

      const result = translator.contentToPidginString(content);

      strictEqual(result, handle);
      strictEqual(result.includes("<file"), false);
      strictEqual(fileSystem.files.size, 0);
    });

    it("handles mixed content with text and binary parts", () => {
      const { translator, fileSystem } = makeTranslatorWithFileSystem();
      const content: LLMContent = {
        parts: [
          { text: "Here is the image:" },
          { storedData: { handle: "stored://pic", mimeType: "image/jpeg" } },
          { text: "And the analysis." },
        ],
      };

      const result = translator.contentToPidginString(content);

      const lines = result.split("\n");
      strictEqual(lines[0], "Here is the image:");
      assertOk(lines[1].includes('<file src="'));
      strictEqual(lines[2], "And the analysis.");
      strictEqual(fileSystem.files.size, 1);
    });
  });
});
