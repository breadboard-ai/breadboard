/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach, afterEach } from "node:test";
import {
  AgentEventConsumer,
  LocalAgentEventBridge,
} from "../../../../src/a2/agent/agent-event-consumer.js";
import { getChatFunctionGroup } from "../../../../src/a2/agent/graph-editing/chat-functions.js";
import type { AgentEvent } from "../../../../src/a2/agent/agent-event.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { EditingAgentPidginTranslator } from "../../../../src/a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import type { FunctionDefinition } from "../../../../src/a2/agent/function-definition.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { bind } from "../../../../src/sca/actions/graph/graph-actions.js";

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
    ],
    edges: [],
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

/**
 * Create a minimal mock controller with selection state for the `bind` proxy.
 */
function createMockBindDeps() {
  return {
    controller: {
      editor: {
        selection: { selection: { nodes: [] } },
      },
    },
    services: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

suite("Chat functions readGraph suspend", () => {
  beforeEach(() => {
    setDOM();
    // Wire the SCA bind proxy so chat-functions can access `bind.controller`
    bind(createMockBindDeps());
  });
  afterEach(() => unsetDOM());

  test("wait_for_user_input emits readGraph suspend events for before/after snapshots", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    const readGraphCalls: AgentEvent[] = [];

    // readGraph handler returns the mock graph
    consumer.on("readGraph", (event) => {
      readGraphCalls.push(event);
      return Promise.resolve({ graph: makeMockGraph() });
    });

    // waitForInput handler simulates user input
    consumer.on("waitForInput", () => {
      return Promise.resolve({
        input: { parts: [{ text: "Hello, agent!" }] },
      });
    });

    const group = getChatFunctionGroup(bridge, translator);
    const handler = findHandler(group, "wait_for_user_input");
    const result = await handler(
      { message: "What would you like to build?" },
      noop,
      null
    );

    // Should have emitted exactly 2 readGraph events (before + after snapshot)
    assert.strictEqual(
      readGraphCalls.length,
      2,
      `Expected 2 readGraph calls, got ${readGraphCalls.length}`
    );

    // Both should be readGraph type with requestIds
    for (const event of readGraphCalls) {
      assert.strictEqual(event.type, "readGraph");
      if (event.type === "readGraph") {
        assert.ok(event.requestId, "Should have a requestId");
      }
    }

    // The requestIds should be different (unique per call)
    if (
      readGraphCalls[0].type === "readGraph" &&
      readGraphCalls[1].type === "readGraph"
    ) {
      assert.notStrictEqual(
        readGraphCalls[0].requestId,
        readGraphCalls[1].requestId,
        "Each readGraph call should have a unique requestId"
      );
    }

    // Result should contain user's message and current graph
    assert.strictEqual(result.user_message, "Hello, agent!");
    assert.ok(result.current_graph, "Should include current_graph");
    assert.ok(
      typeof result.current_graph === "string",
      "current_graph should be a string"
    );
  });

  test("wait_for_user_input detects graph changes between before/after snapshots", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const translator = new EditingAgentPidginTranslator();

    let callCount = 0;

    // Return different graphs for before vs after to simulate a user edit
    consumer.on("readGraph", () => {
      callCount++;
      if (callCount === 1) {
        // Before snapshot: one node
        return Promise.resolve({
          graph: {
            nodes: [
              {
                id: "step-a",
                type: "test-type",
                metadata: { title: "Step Alpha" },
              },
            ],
            edges: [],
          },
        });
      } else {
        // After snapshot: two nodes (user added one)
        return Promise.resolve({
          graph: {
            nodes: [
              {
                id: "step-a",
                type: "test-type",
                metadata: { title: "Step Alpha" },
              },
              {
                id: "step-b",
                type: "test-type",
                metadata: { title: "Step Beta" },
              },
            ],
            edges: [],
          },
        });
      }
    });

    consumer.on("waitForInput", () => {
      return Promise.resolve({
        input: { parts: [{ text: "I added a new step" }] },
      });
    });

    const group = getChatFunctionGroup(bridge, translator);
    const handler = findHandler(group, "wait_for_user_input");
    const result = await handler({ message: "Ready" }, noop, null);

    assert.strictEqual(result.user_message, "I added a new step");
    // graph_changes should be present since the graph changed
    assert.ok(
      result.graph_changes,
      "Should include graph_changes when graph was modified"
    );
    assert.ok(
      typeof result.graph_changes === "string",
      "graph_changes should be a string"
    );
  });
});
