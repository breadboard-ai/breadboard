/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import { ok as assert, strictEqual } from "node:assert";
import { createAgentConfigurator } from "../../src/a2/agent/agent-function-configurator.js";
import { stubCaps, stubModuleArgs } from "../useful-stubs.js";
import {
  createMockGenerators,
  createMockFileSystem,
  createMockTranslator,
} from "./functions/generate-test-utils.js";
import type { AgentUI } from "../../src/a2/agent/ui.js";
import type { LLMContent } from "@breadboard-ai/types";

function createMockDeps() {
  const fs = createMockFileSystem();
  // Add methods the configurator uses that aren't in createMockFileSystem
  /* eslint-disable @typescript-eslint/no-explicit-any */
  (fs as any).addSystemFile = mock.fn();
  (fs as any).setUseMemory = mock.fn();
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    fileSystem: fs,
    translator: createMockTranslator(),
    ui: {
      chatLog: [] as LLMContent[],
    } as unknown as AgentUI,
  };
}

function createFlags(overrides: Record<string, unknown> = {}) {
  return {
    uiType: "chat" as const,
    useMemory: false,
    useNotebookLM: false,
    objective: { parts: [{ text: "test" }], role: "user" as const },
    params: {},
    onSuccess: mock.fn(async () => undefined) as never,
    onFailure: mock.fn() as never,
    ...overrides,
  };
}

/**
 * Helper to find a function group by checking if any of its definitions
 * includes a function with the given name.
 */
function hasFunction(
  groups: { definitions: [string, unknown][] }[],
  name: string
) {
  return groups.some((g) => g.definitions.some(([n]) => n === name));
}

describe("createAgentConfigurator", () => {
  it("returns a function", () => {
    const configureFn = createAgentConfigurator(
      stubCaps,
      stubModuleArgs,
      createMockGenerators()
    );
    strictEqual(typeof configureFn, "function");
  });

  describe("base function groups", () => {
    it("always includes system and generate groups", async () => {
      const configureFn = createAgentConfigurator(
        stubCaps,
        stubModuleArgs,
        createMockGenerators()
      );
      const result = await configureFn(createMockDeps(), createFlags());
      assert(Array.isArray(result), "Should return an array");
      // System group has "report_success", generate group has "generate_text"
      assert(
        hasFunction(
          result as { definitions: [string, unknown][] }[],
          "system_objective_fulfilled"
        ),
        "Should include system group (system_objective_fulfilled)"
      );
      assert(
        hasFunction(
          result as { definitions: [string, unknown][] }[],
          "generate_text"
        ),
        "Should include generate group (generate_text)"
      );
    });
  });

  describe("memory group", () => {
    it("includes memory group when useMemory is true", async () => {
      const configureFn = createAgentConfigurator(
        stubCaps,
        stubModuleArgs,
        createMockGenerators()
      );
      const result = await configureFn(
        createMockDeps(),
        createFlags({ useMemory: true })
      );
      assert(
        hasFunction(
          result as { definitions: [string, unknown][] }[],
          "memory_create_sheet"
        ),
        "Should include memory group (memory_create_sheet)"
      );
    });

    it("excludes memory group when useMemory is false", async () => {
      const configureFn = createAgentConfigurator(
        stubCaps,
        stubModuleArgs,
        createMockGenerators()
      );
      const result = await configureFn(
        createMockDeps(),
        createFlags({ useMemory: false })
      );
      assert(
        !hasFunction(
          result as { definitions: [string, unknown][] }[],
          "memory_create_sheet"
        ),
        "Should not include memory group"
      );
    });
  });

  describe("UI groups", () => {
    it("includes chat group when uiType is 'chat'", async () => {
      const configureFn = createAgentConfigurator(
        stubCaps,
        stubModuleArgs,
        createMockGenerators()
      );
      const result = await configureFn(
        createMockDeps(),
        createFlags({ uiType: "chat" })
      );
      assert(
        hasFunction(
          result as { definitions: [string, unknown][] }[],
          "chat_request_user_input"
        ),
        "Should include chat group (chat_request_user_input)"
      );
    });

    it("excludes chat and a2ui functions when uiType forces no-ui path", async () => {
      const configureFn = createAgentConfigurator(
        stubCaps,
        stubModuleArgs,
        createMockGenerators()
      );
      // Cast to bypass the UIType union and hit the else branch
      const result = await configureFn(
        createMockDeps(),
        createFlags({ uiType: "other" as never })
      );
      assert(Array.isArray(result), "Should return an array");
      // Should not include chat functions
      assert(
        !hasFunction(
          result as { definitions: [string, unknown][] }[],
          "chat_with_user"
        ),
        "Should not include chat group"
      );
    });
  });
});
