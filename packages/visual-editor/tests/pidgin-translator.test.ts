/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { PidginTranslator } from "../src/a2/agent/pidgin-translator.js";
import { stubCaps, stubModuleArgs } from "./useful-stubs.js";
import { AgentFileSystem } from "../src/a2/agent/file-system.js";
import { deepStrictEqual, fail } from "node:assert";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { Template } from "../src/a2/a2/template.js";
import { ROUTE_TOOL_PATH } from "../src/a2/a2/tool-manager.js";
import { llm } from "../src/a2/a2/utils.js";

describe("Pidgin Translator", () => {
  it("toPidgin correctly adds routes", async () => {
    const fileSystem = new AgentFileSystem();
    const translator = new PidginTranslator(
      stubCaps,
      stubModuleArgs,
      fileSystem
    );

    const translated = await translator.toPidgin(
      llm`Go to ${Template.route("Route A", "/route-a")}`.asContent(),
      {}
    );
    if (!ok(translated)) {
      fail(translated.$error);
    }
    const { text } = translated;
    deepStrictEqual(text, `Go to <a href="/route-a">Route A</a>`);
  });

  it("toPidgin correctly fails when adding malformed routes", async () => {
    const fileSystem = new AgentFileSystem();
    const translator = new PidginTranslator(
      stubCaps,
      stubModuleArgs,
      fileSystem
    );

    const translated = await translator.toPidgin(
      llm`Go to ${Template.part({ type: "tool", title: "Route A", path: ROUTE_TOOL_PATH })}`.asContent(),
      {}
    );
    if (ok(translated)) {
      fail(`No error when adding malformed route`);
    }
  });
});
