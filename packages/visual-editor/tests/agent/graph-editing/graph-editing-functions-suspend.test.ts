/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  AgentEventConsumer,
  LocalAgentEventBridge,
} from "../../../src/a2/agent/agent-event-consumer.js";
import { getGraphEditingFunctionGroup } from "../../../src/a2/agent/graph-editing/functions.js";
import type {
  ReadGraphPayload,
  ApplyEditsPayload,
} from "../../../src/a2/agent/agent-event.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { EditingAgentPidginTranslator } from "../../../src/a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import type { FunctionDefinition } from "../../../src/a2/agent/function-definition.js";

/**
 * A minimal mock graph for testing.
 */
function makeMockGraph(): GraphDescriptor {
  return {
    nodes: [
      {
        id: "step-a",
        type: "test-type",
        metadata: { title: "Step Alpha" },
        configuration: { config$prompt: "Do the thing" },
      },
      {
        id: "step-b",
        type: "test-type",
        metadata: { title: "Step Beta" },
        configuration: {},
      },
    ],
    edges: [{ from: "step-a", out: "output", to: "step-b", in: "input" }],
  };
}

/**
 * Get a function handler by name from a FunctionGroup.
 */
function findHandler(
  group: { definitions: [string, FunctionDefinition][] },
  name: string
): (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  statusUpdateCallback: () => void,
  reporter: null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any> {
  const found = group.definitions.find(([n]) => n === name);
  if (!found) throw new Error(`Function "${name}" not found`);
  return found[1].handler;
}

const noop = () => {};

suite("Graph editing functions suspend/resume", () => {
  // ── graph_get_overview ────────────────────────────────────────────────────

  test("graph_get_overview emits readGraph and returns overview", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    const captured: ReadGraphPayload[] = [];
    consumer.on("readGraph", (payload) => {
      captured.push(payload);
      return Promise.resolve({ graph: makeMockGraph() });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_get_overview");
    const result = await handler({}, noop, null);

    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].requestId, "Should have a requestId");

    // The result should contain a YAML overview string
    assert.ok("overview" in result);
    assert.ok(
      typeof result.overview === "string",
      "overview should be a string"
    );
    assert.ok(result.overview.length > 0, "overview should not be empty");
  });

  // ── graph_remove_step ─────────────────────────────────────────────────────

  test("graph_remove_step emits applyEdits with removenode EditSpec", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    const captured: ApplyEditsPayload[] = [];
    consumer.on("applyEdits", (payload) => {
      captured.push(payload);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_remove_step");
    const result = await handler({ step_id: "step-a" }, noop, null);

    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].requestId, "Should have a requestId");
    assert.ok(captured[0].edits, "Should have edits");
    assert.strictEqual(captured[0].edits!.length, 1);
    assert.deepStrictEqual(captured[0].edits![0], {
      type: "removenode",
      id: "step-a",
      graphId: "",
    });

    assert.strictEqual(result.success, true);
  });

  // ── graph_remove_asset ────────────────────────────────────────────────────

  test("graph_remove_asset emits applyEdits with removeasset EditSpec", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    const captured: ApplyEditsPayload[] = [];
    consumer.on("applyEdits", (payload) => {
      captured.push(payload);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_remove_asset");
    const result = await handler({ path: "/assets/image.png" }, noop, null);

    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].requestId, "Should have a requestId");
    assert.ok(captured[0].edits, "Should have edits");
    assert.strictEqual(captured[0].edits!.length, 1);
    assert.deepStrictEqual(captured[0].edits![0], {
      type: "removeasset",
      path: "/assets/image.png",
    });

    assert.strictEqual(result.success, true);
  });

  test("graph_remove_step returns error on failure", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    consumer.on("applyEdits", () => {
      return Promise.resolve({ success: false, error: "Not found" });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_remove_step");
    const result = await handler({ step_id: "nonexistent" }, noop, null);

    assert.strictEqual(result.success, false);
  });

  // ── upsert_agent_step (create) ────────────────────────────────────────────

  test("upsert_agent_step creates new step via applyEdits with addnode", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    const captured: ApplyEditsPayload[] = [];

    // readGraph will be called for nodeTitleResolver
    consumer.on("readGraph", () => {
      return Promise.resolve({ graph: makeMockGraph() });
    });

    consumer.on("applyEdits", (payload) => {
      captured.push(payload);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "upsert_agent_step");
    const result = await handler(
      {
        title: "New Step",
        prompt: "Do something interesting",
      },
      noop,
      null
    );

    // Should have 1 applyEdits event (addnode)
    assert.strictEqual(captured.length, 1);

    // First should be addnode
    const addPayload = captured[0];
    assert.ok(addPayload.edits, "Should have raw edits for addnode");
    assert.strictEqual(addPayload.edits![0].type, "addnode");

    assert.ok(result.step_id, "Should return a step_id handle");
  });

  // ── upsert_agent_step (update) ────────────────────────────────────────────

  test("upsert_agent_step updates existing step via updateNode transform", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    // Pre-register a handle for step-a so translator can resolve it
    translator.getOrCreateHandle("step-a");

    const captured: ApplyEditsPayload[] = [];

    consumer.on("readGraph", () => {
      return Promise.resolve({ graph: makeMockGraph() });
    });

    consumer.on("applyEdits", (payload) => {
      captured.push(payload);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "upsert_agent_step");

    // Use the handle that translator created for "step-a"
    const handle = translator.getOrCreateHandle("step-a");
    const result = await handler(
      {
        step_id: handle,
        title: "Updated Step",
        prompt: "Updated prompt text",
      },
      noop,
      null
    );

    // Should have 1 applyEdits event (updateNode)
    assert.strictEqual(captured.length, 1);

    // First should be updateNode transform
    const updatePayload = captured[0];
    assert.ok(updatePayload.transform, "Should have transform descriptor");
    assert.strictEqual(updatePayload.transform!.kind, "updateNode");
    if (updatePayload.transform!.kind === "updateNode") {
      assert.strictEqual(updatePayload.transform!.nodeId, "step-a");
      assert.ok(
        updatePayload.transform!.configuration,
        "Should have configuration"
      );
    }

    assert.ok(result.step_id, "Should return a step_id handle");
    assert.ok(!result.error, "Should not have an error");
  });

  test("upsert_agent_step returns error for nonexistent step_id", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    consumer.on("readGraph", () => {
      return Promise.resolve({ graph: makeMockGraph() });
    });

    consumer.on("applyEdits", () => {
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "upsert_agent_step");
    const result = await handler(
      {
        step_id: "nonexistent-handle",
        title: "Some title",
        prompt: "Some prompt",
      },
      noop,
      null
    );

    assert.ok(result.error, "Should return an error");
    assert.ok(
      result.error.includes("not found"),
      `Error should mention not found, got: ${result.error}`
    );
  });

  // ── graph_edit_properties ──────────────────────────────────────────────────

  test("graph_edit_properties emits applyEdits with updateGraphProperties transform", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    const captured: ApplyEditsPayload[] = [];
    consumer.on("applyEdits", (payload) => {
      captured.push(payload);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_edit_properties");
    const result = await handler(
      {
        title: "Updated Title",
        description: "Updated Description",
      },
      noop,
      null
    );

    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].requestId, "Should have a requestId");
    assert.ok(captured[0].transform, "Should have a transform");
    assert.strictEqual(captured[0].transform!.kind, "updateGraphProperties");
    if (captured[0].transform!.kind === "updateGraphProperties") {
      assert.strictEqual(captured[0].transform!.title, "Updated Title");
      assert.strictEqual(
        captured[0].transform!.description,
        "Updated Description"
      );
      assert.strictEqual(captured[0].transform!.themeIntent, undefined);
    }

    assert.strictEqual(result.success, true);
  });

  // ── graph_update_theme ────────────────────────────────────────────────────

  test("graph_update_theme fires and forgets — returns immediately, dispatches in background", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    // applyUpdateTheme reads the graph to snapshot title/description.
    consumer.on("readGraph", () =>
      Promise.resolve({
        graph: {
          ...makeMockGraph(),
          title: "My Great Opal",
          description: "A wonderful creation",
        },
      })
    );

    const captured: ApplyEditsPayload[] = [];
    consumer.on("applyEdits", (payload) => {
      captured.push(payload);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_update_theme");
    const result = await handler(
      {
        theme_intent: "sunset vibe",
      },
      noop,
      null
    );

    // The handler returns success immediately (fire-and-forget).
    assert.strictEqual(result.success, true);
    assert.ok(
      typeof result.message === "string" && result.message.length > 0,
      "Should return a status message"
    );
    // Title and description are included so devtools can show what was
    // used to generate the theme.
    assert.strictEqual(result.title, "My Great Opal");
    assert.strictEqual(result.description, "A wonderful creation");

    // Flush the microtask queue so the fire-and-forget promise settles.
    await new Promise((r) => setTimeout(r, 0));

    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].requestId, "Should have a requestId");
    assert.ok(captured[0].transform, "Should have a transform");
    assert.strictEqual(captured[0].transform!.kind, "updateGraphProperties");
    if (captured[0].transform!.kind === "updateGraphProperties") {
      assert.strictEqual(
        captured[0].transform!.title,
        "My Great Opal",
        "Should forward graph title to theme generator"
      );
      assert.strictEqual(
        captured[0].transform!.description,
        "A wonderful creation",
        "Should forward graph description to theme generator"
      );
      assert.strictEqual(captured[0].transform!.themeIntent, "sunset vibe");
    }
  });

  // ── instruction generation and product name replacements ──────────────────

  test("getGraphEditingFunctionGroup instruction uses default product name (Opal)", () => {
    const bridge = new LocalAgentEventBridge(new AgentEventConsumer());
    const translator = new EditingAgentPidginTranslator();

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const inst = group.instruction;
    assert.ok(inst);

    // It should contain the capitalized default product name: "Opal" and "Opals"
    assert.ok(/\bOpal\b/.test(inst), "Should include 'Opal'");
    assert.ok(/\bOpals\b/.test(inst), "Should include 'Opals'");
    assert.ok(!/\bGem\b/.test(inst), "Should not include 'Gem'");
    assert.ok(!/\bGems\b/.test(inst), "Should not include 'Gems'");

    // It should not contain lowercase names
    assert.ok(!/\bopal\b/.test(inst), "Should not include lowercase 'opal'");
    assert.ok(!/\bopals\b/.test(inst), "Should not include lowercase 'opals'");
  });

  test("getGraphEditingFunctionGroup instruction uses custom product name (Gem)", () => {
    const bridge = new LocalAgentEventBridge(new AgentEventConsumer());
    const translator = new EditingAgentPidginTranslator();

    const group = getGraphEditingFunctionGroup(bridge, translator, "Gem");
    const inst = group.instruction;
    assert.ok(inst);

    // It should contain "Gem" and "Gems"
    assert.ok(/\bGem\b/.test(inst), "Should include 'Gem'");
    assert.ok(/\bGems\b/.test(inst), "Should include 'Gems'");
    assert.ok(!/\bOpal\b/.test(inst), "Should not include 'Opal'");
    assert.ok(!/\bOpals\b/.test(inst), "Should not include 'Opals'");

    // It should not contain lowercase names
    assert.ok(!/\bgem\b/.test(inst), "Should not include lowercase 'gem'");
    assert.ok(!/\bgems\b/.test(inst), "Should not include lowercase 'gems'");
  });
});
