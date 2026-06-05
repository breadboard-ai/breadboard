/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { getChatFunctionGroup } from "../../../src/a2/agent/graph-editing/chat-functions.js";
import { buildGraphEditingFunctionGroups } from "../../../src/a2/agent/graph-editing/configurator.js";
import { EditingAgentPidginTranslator } from "../../../src/a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import { AgentEventConsumer, LocalAgentEventBridge } from "../../../src/a2/agent/agent-event-consumer.js";

suite("Guide-only mode configuration and instructions", () => {
  test("getChatFunctionGroup includes guide instructions when isReadOnly is true", () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    // With isReadOnly = true
    const groupWithGuide = getChatFunctionGroup(bridge, translator, true);
    assert.ok(groupWithGuide.instruction, "Should have instructions");
    assert.ok(
      groupWithGuide.instruction.includes("Guide-only Mode"),
      "Instructions should contain Guide-only Mode title"
    );
    assert.ok(
      groupWithGuide.instruction.includes("read-only"),
      "Instructions should contain read-only references"
    );

    // With isReadOnly = false (default)
    const groupDefault = getChatFunctionGroup(bridge, translator);
    assert.ok(groupDefault.instruction, "Should have instructions");
    assert.strictEqual(
      groupDefault.instruction.includes("Guide-only Mode"),
      false,
      "Default chat instructions should NOT contain Guide-only Mode"
    );
  });

  test("buildGraphEditingFunctionGroups returns only chat group when isReadOnly is true", () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    // When isReadOnly = true
    const groupsReadOnly = buildGraphEditingFunctionGroups({
      sink: bridge,
      translator,
      productName: "Opal",
      isReadOnly: true,
    });

    assert.strictEqual(
      groupsReadOnly.length,
      1,
      "Should return exactly 1 function group in read-only mode"
    );
    assert.strictEqual(
      groupsReadOnly[0].definitions.some(([name]) => name === "wait_for_user_input"),
      true,
      "The single group should be the chat group containing wait_for_user_input"
    );

    // When isReadOnly = false
    const groupsEditable = buildGraphEditingFunctionGroups({
      sink: bridge,
      translator,
      productName: "Opal",
      isReadOnly: false,
    });

    assert.strictEqual(
      groupsEditable.length,
      2,
      "Should return exactly 2 function groups in editable mode"
    );
    assert.strictEqual(
      groupsEditable.some((g) => g.definitions.some(([name]) => name === "upsert_agent_step")),
      true,
      "Should include graph editing function group"
    );
  });
});
