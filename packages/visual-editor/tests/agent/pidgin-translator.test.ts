/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { PidginTranslator } from "../../src/a2/agent/pidgin-translator.js";
import {
  stubCaps,
  stubMemoryManager,
  stubModuleArgs,
} from "../useful-stubs.js";
import { AgentFileSystem } from "../../src/a2/agent/file-system.js";
import { deepStrictEqual, fail } from "node:assert";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { Template } from "../../src/a2/a2/template.js";
import { ROUTE_TOOL_PATH } from "../../src/a2/a2/tool-manager.js";
import { llm } from "../../src/a2/a2/utils.js";
import { escapeHtml } from "../../src/utils/escape-html.js";

function makeTranslator(): PidginTranslator {
  const fileSystem = new AgentFileSystem({ memoryManager: stubMemoryManager });
  return new PidginTranslator(stubCaps, stubModuleArgs, fileSystem);
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
        memoryManager: stubMemoryManager,
      });
      const translator = new PidginTranslator(
        stubCaps,
        stubModuleArgs,
        fileSystem
      );

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
  });
});
