/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { AgentUI } from "../../src/a2/agent/ui.js";
import {
  AgentEventConsumer,
  LocalAgentEventBridge,
} from "../../src/a2/agent/agent-event-consumer.js";
import type { AgentEvent } from "../../src/a2/agent/agent-event.js";
import type { A2ModuleArgs } from "../../src/a2/runnable-module-factory.js";
import type { PidginTranslator } from "../../src/a2/agent/pidgin-translator.js";
import type {
  ChatResponse,
  ChatChoicesResponse,
} from "../../src/a2/agent/types.js";
import { ok } from "@breadboard-ai/utils";

/**
 * Minimal stubs for AgentUI dependencies.
 * AgentUI's constructor calls getCurrentStepState(moduleArgs), which returns
 * empty state when currentStep is undefined — no console entry, no app screen.
 * This is fine for testing the suspend flow since the side effects
 * (chat log, console output) are no-ops without a console entry.
 */
function makeModuleArgsStub(): A2ModuleArgs {
  return {
    context: {
      currentStep: undefined,
      getProjectRunState: () => undefined,
    },
  } as unknown as A2ModuleArgs;
}

function makeTranslatorStub(): PidginTranslator {
  return {
    fromPidginString: async (s: string) => ({
      parts: [{ text: s }],
    }),
  } as unknown as PidginTranslator;
}

suite("AgentUI suspend/resume", () => {
  // ── chat() ─────────────────────────────────────────────────────────────────

  test("chat() emits waitForInput event with correct shape", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    const captured: AgentEvent[] = [];
    consumer.on("waitForInput", (event) => {
      captured.push(event);
      return Promise.resolve({
        input: { parts: [{ text: "user reply" }] },
      });
    });

    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub(), bridge);
    const result = await ui.chat("What do you want?", "text");

    assert.ok(ok(result), "chat() should return ok");
    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].type, "waitForInput");
    if (captured[0].type === "waitForInput") {
      assert.strictEqual(captured[0].inputType, "edit_note");
      assert.deepStrictEqual(captured[0].prompt, {
        parts: [{ text: "What do you want?" }],
      });
      assert.ok(captured[0].requestId, "Should have a requestId");
    }
  });

  test("chat() returns the ChatResponse from the consumer handler", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    const expectedResponse: ChatResponse = {
      input: { parts: [{ text: "I want a poem" }] },
    };

    consumer.on("waitForInput", () => {
      return Promise.resolve(expectedResponse);
    });

    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub(), bridge);
    const result = await ui.chat("What do you want?", "text");

    assert.ok(ok(result));
    assert.deepStrictEqual(result.input, expectedResponse.input);
  });

  test("chat() returns error when no sink is available", async () => {
    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub());
    const result = await ui.chat("Hello?", "text");

    assert.ok(!ok(result), "Should return an error");
    assert.ok(
      result.$error.includes("no event sink"),
      `Error message should mention missing sink, got: ${result.$error}`
    );
  });

  // ── presentChoices() ───────────────────────────────────────────────────────

  test("presentChoices() emits waitForChoice event with correct shape", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    const captured: AgentEvent[] = [];
    consumer.on("waitForChoice", (event) => {
      captured.push(event);
      return Promise.resolve({ selected: ["a"] });
    });

    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub(), bridge);
    const result = await ui.presentChoices(
      "Pick one",
      [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" },
      ],
      "single"
    );

    assert.ok(ok(result), "presentChoices() should return ok");
    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].type, "waitForChoice");
    if (captured[0].type === "waitForChoice") {
      assert.strictEqual(captured[0].selectionMode, "single");
      assert.deepStrictEqual(captured[0].prompt, {
        parts: [{ text: "Pick one" }],
      });
      assert.strictEqual(captured[0].choices.length, 2);
      assert.strictEqual(captured[0].choices[0].id, "a");
      assert.deepStrictEqual(captured[0].choices[0].content, {
        parts: [{ text: "Option A" }],
      });
      assert.ok(captured[0].requestId, "Should have a requestId");
    }
  });

  test("presentChoices() returns the ChatChoicesResponse from the consumer", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    const expectedResponse: ChatChoicesResponse = {
      selected: ["b", "c"],
    };

    consumer.on("waitForChoice", () => {
      return Promise.resolve(expectedResponse);
    });

    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub(), bridge);
    const result = await ui.presentChoices(
      "Pick several",
      [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
      ],
      "multiple"
    );

    assert.ok(ok(result));
    assert.deepStrictEqual(result.selected, ["b", "c"]);
  });

  test("presentChoices() passes layout and noneOfTheAboveLabel", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    const captured: AgentEvent[] = [];
    consumer.on("waitForChoice", (event) => {
      captured.push(event);
      return Promise.resolve({ selected: [] });
    });

    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub(), bridge);
    await ui.presentChoices(
      "Pick",
      [{ id: "x", label: "X" }],
      "single",
      "grid",
      "None of these"
    );

    assert.strictEqual(captured.length, 1);
    if (captured[0].type === "waitForChoice") {
      assert.strictEqual(captured[0].layout, "grid");
      assert.strictEqual(captured[0].noneOfTheAboveLabel, "None of these");
    }
  });

  test("presentChoices() returns error when no sink is available", async () => {
    const ui = new AgentUI(makeModuleArgsStub(), makeTranslatorStub());
    const result = await ui.presentChoices(
      "Pick one",
      [{ id: "a", label: "A" }],
      "single"
    );

    assert.ok(!ok(result), "Should return an error");
    assert.ok(
      result.$error.includes("no event sink"),
      `Error message should mention missing sink, got: ${result.$error}`
    );
  });
});
