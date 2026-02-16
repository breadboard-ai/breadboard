/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { GraphEditingAgentController } from "../../../../../../src/sca/controller/subcontrollers/editor/graph-editing-agent-controller.js";

suite("GraphEditingAgentController", () => {
  // ── entries & addMessage ──────────────────────────────────────────────────

  test("starts with no entries", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_1",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    assert.deepStrictEqual(ctrl.entries, []);
  });

  test("addMessage appends a message entry", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_2",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addMessage("user", "Hello");
    await ctrl.isSettled;

    assert.strictEqual(ctrl.entries.length, 1);
    assert.deepStrictEqual(ctrl.entries[0], {
      kind: "message",
      role: "user",
      text: "Hello",
    });
  });

  test("addMessage supports all three roles", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_3",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addMessage("user", "u");
    ctrl.addMessage("model", "m");
    ctrl.addMessage("system", "s");
    await ctrl.isSettled;

    assert.strictEqual(ctrl.entries.length, 3);
    assert.strictEqual(ctrl.entries[0].kind, "message");
    assert.strictEqual(
      (ctrl.entries[0] as { kind: "message"; role: string }).role,
      "user"
    );
    assert.strictEqual(
      (ctrl.entries[1] as { kind: "message"; role: string }).role,
      "model"
    );
    assert.strictEqual(
      (ctrl.entries[2] as { kind: "message"; role: string }).role,
      "system"
    );
  });

  // ── addThought ────────────────────────────────────────────────────────────

  test("addThought creates a new thought group", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_4",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addThought("Just thinking");
    await ctrl.isSettled;

    assert.strictEqual(ctrl.entries.length, 1);
    const entry = ctrl.entries[0];
    assert.strictEqual(entry.kind, "thought-group");
    if (entry.kind !== "thought-group") return;
    assert.strictEqual(entry.thoughts.length, 1);
    assert.strictEqual(entry.thoughts[0].body, "Just thinking");
    assert.strictEqual(entry.thoughts[0].title, null);
  });

  test("addThought appends to existing thought group", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_5",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addThought("First thought");
    ctrl.addThought("Second thought");
    await ctrl.isSettled;

    // Should still be a single thought-group
    assert.strictEqual(ctrl.entries.length, 1);
    const entry = ctrl.entries[0];
    assert.strictEqual(entry.kind, "thought-group");
    if (entry.kind !== "thought-group") return;
    assert.strictEqual(entry.thoughts.length, 2);
    assert.strictEqual(entry.thoughts[0].body, "First thought");
    assert.strictEqual(entry.thoughts[1].body, "Second thought");
  });

  test("addThought creates new group after a message", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_6",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addThought("Thought A");
    ctrl.addMessage("model", "Reply");
    ctrl.addThought("Thought B");
    await ctrl.isSettled;

    // 3 entries: thought-group, message, thought-group
    assert.strictEqual(ctrl.entries.length, 3);
    assert.strictEqual(ctrl.entries[0].kind, "thought-group");
    assert.strictEqual(ctrl.entries[1].kind, "message");
    assert.strictEqual(ctrl.entries[2].kind, "thought-group");
  });

  test("addThought parses **Title** format", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_7",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addThought("**Analyzing** the graph structure");
    await ctrl.isSettled;

    const entry = ctrl.entries[0];
    assert.strictEqual(entry.kind, "thought-group");
    if (entry.kind !== "thought-group") return;
    assert.strictEqual(entry.thoughts[0].title, "Analyzing");
    assert.strictEqual(entry.thoughts[0].body, "the graph structure");
  });

  // ── showGreeting ──────────────────────────────────────────────────────────

  test("showGreeting adds a model message when empty", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_8",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.showGreeting();
    await ctrl.isSettled;

    assert.strictEqual(ctrl.entries.length, 1);
    const entry = ctrl.entries[0];
    assert.strictEqual(entry.kind, "message");
    if (entry.kind !== "message") return;
    assert.strictEqual(entry.role, "model");
    assert.ok(entry.text.length > 0, "Greeting text should not be empty");
  });

  test("showGreeting is a no-op when entries exist", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_9",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.addMessage("user", "Hello");
    ctrl.showGreeting();
    await ctrl.isSettled;

    assert.strictEqual(ctrl.entries.length, 1);
    assert.strictEqual(
      (ctrl.entries[0] as { kind: "message"; text: string }).text,
      "Hello"
    );
  });

  // ── Boolean flags ─────────────────────────────────────────────────────────

  test("boolean flags default to false", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_10",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.open, false);
    assert.strictEqual(ctrl.waiting, false);
    assert.strictEqual(ctrl.processing, false);
    assert.strictEqual(ctrl.loopRunning, false);
  });

  test("boolean flags are settable", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_11",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.open = true;
    ctrl.waiting = true;
    ctrl.processing = true;
    ctrl.loopRunning = true;
    await ctrl.isSettled;

    assert.strictEqual(ctrl.open, true);
    assert.strictEqual(ctrl.waiting, true);
    assert.strictEqual(ctrl.processing, true);
    assert.strictEqual(ctrl.loopRunning, true);
  });

  // ── currentFlow ───────────────────────────────────────────────────────────

  test("currentFlow defaults to null", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_12",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.currentFlow, null);
  });

  test("currentFlow is settable", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_13",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    ctrl.currentFlow = "flow-123";
    await ctrl.isSettled;
    assert.strictEqual(ctrl.currentFlow, "flow-123");
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  test("reset clears all state", async () => {
    const ctrl = new GraphEditingAgentController(
      "GEA_ctrl_14",
      "GraphEditingAgentController"
    );
    await ctrl.isHydrated;

    // Set up all state
    ctrl.addMessage("user", "Hello");
    ctrl.addThought("Thinking");
    ctrl.open = true;
    ctrl.waiting = true;
    ctrl.processing = true;
    ctrl.loopRunning = true;
    ctrl.currentFlow = "flow-xyz";
    await ctrl.isSettled;

    ctrl.reset();
    await ctrl.isSettled;

    assert.deepStrictEqual(ctrl.entries, []);
    assert.strictEqual(ctrl.open, false);
    assert.strictEqual(ctrl.waiting, false);
    assert.strictEqual(ctrl.processing, false);
    assert.strictEqual(ctrl.loopRunning, false);
    assert.strictEqual(ctrl.currentFlow, null);
  });
});
