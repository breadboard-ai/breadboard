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
import type { AgentEvent } from "../../../src/a2/agent/agent-event.js";
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

    const captured: AgentEvent[] = [];
    consumer.on("readGraph", (event) => {
      captured.push(event);
      return Promise.resolve({ graph: makeMockGraph() });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_get_overview");
    const result = await handler({}, noop, null);

    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].type, "readGraph");
    if (captured[0].type === "readGraph") {
      assert.ok(captured[0].requestId, "Should have a requestId");
    }

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

    const captured: AgentEvent[] = [];
    consumer.on("applyEdits", (event) => {
      captured.push(event);
      return Promise.resolve({ success: true });
    });

    const group = getGraphEditingFunctionGroup(bridge, translator);
    const handler = findHandler(group, "graph_remove_step");
    const result = await handler({ step_id: "step-a" }, noop, null);

    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].type, "applyEdits");
    if (captured[0].type === "applyEdits") {
      assert.ok(captured[0].requestId, "Should have a requestId");
      assert.ok(captured[0].edits, "Should have edits");
      assert.strictEqual(captured[0].edits!.length, 1);
      assert.deepStrictEqual(captured[0].edits![0], {
        type: "removenode",
        id: "step-a",
        graphId: "",
      });
    }

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

    const captured: AgentEvent[] = [];

    // readGraph will be called for nodeTitleResolver
    consumer.on("readGraph", () => {
      return Promise.resolve({ graph: makeMockGraph() });
    });

    consumer.on("applyEdits", (event) => {
      captured.push(event);
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

    // Should have at least 2 applyEdits: addnode + layoutGraph
    assert.ok(
      captured.length >= 2,
      `Expected >= 2 applyEdits events, got ${captured.length}`
    );

    // First should be addnode
    const addEvent = captured[0];
    assert.strictEqual(addEvent.type, "applyEdits");
    if (addEvent.type === "applyEdits") {
      assert.ok(addEvent.edits, "Should have raw edits for addnode");
      assert.strictEqual(addEvent.edits![0].type, "addnode");
    }

    // Last should be layoutGraph transform
    const layoutEvent = captured[captured.length - 1];
    if (layoutEvent.type === "applyEdits") {
      assert.ok(layoutEvent.transform, "Last event should be a transform");
      assert.strictEqual(layoutEvent.transform!.kind, "layoutGraph");
    }

    assert.ok(result.step_id, "Should return a step_id handle");
  });

  // ── upsert_agent_step (update) ────────────────────────────────────────────

  test("upsert_agent_step updates existing step via updateNode transform", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    // Pre-register a handle for step-a so translator can resolve it
    translator.getOrCreateHandle("step-a");

    const captured: AgentEvent[] = [];

    consumer.on("readGraph", () => {
      return Promise.resolve({ graph: makeMockGraph() });
    });

    consumer.on("applyEdits", (event) => {
      captured.push(event);
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

    // Should have at least 2 applyEdits: updateNode + layoutGraph
    assert.ok(
      captured.length >= 2,
      `Expected >= 2 applyEdits events, got ${captured.length}`
    );

    // First should be updateNode transform
    const updateEvent = captured[0];
    if (updateEvent.type === "applyEdits") {
      assert.ok(updateEvent.transform, "Should have transform descriptor");
      assert.strictEqual(updateEvent.transform!.kind, "updateNode");
      if (updateEvent.transform!.kind === "updateNode") {
        assert.strictEqual(updateEvent.transform!.nodeId, "step-a");
        assert.ok(
          updateEvent.transform!.configuration,
          "Should have configuration"
        );
      }
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
});
