/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { beforeEach, suite, test } from "node:test";
import { setDOM } from "../../../fake-dom.js";
import { makeTestController } from "../../helpers/mock-controller.js";
import {
  processEvent,
  type NodeAgentBridge,
} from "../../../../src/sca/actions/run/backend-run-action.js";
import type { GraphRunEvent } from "../../../../src/sca/services/graph-run-service.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



/**
 * Creates a controller with a mock inspectable graph that returns basic
 * node metadata. This satisfies processEvent's `controller.editor.graph
 * .get()?.graphs.get("")` lookups.
 */
function makeControllerWithGraph() {
  const { controller, mocks } = makeTestController();

  // Wire up the mock graph so that `controller.editor.graph.get()`
  // returns an inspectable with a `.graphs` map containing the root
  // graph (""). Each node stub returns a title and empty
  // describe/ports.
  const mockNodes = new Map<
    string,
    {
      title: () => string;
      currentDescribe: () => { metadata: object; outputSchema?: object };
      currentPorts: () => {
        inputs: { ports: never[] };
        outputs: { ports: never[] };
      };
    }
  >();

  const mockRootGraph = {
    nodeById: (id: string) => mockNodes.get(id),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (controller.editor.graph as any).get = () => ({
    graphs: new Map([["", mockRootGraph]]),
  });

  /** Register a node that processEvent can look up. */
  function addNode(
    id: string,
    title = id,
    outputSchema: object = {}
  ) {
    mockNodes.set(id, {
      title: () => title,
      currentDescribe: () => ({
        metadata: {},
        outputSchema,
      }),
      currentPorts: () => ({
        inputs: { ports: [] },
        outputs: { ports: [] },
      }),
    });
  }

  return { controller, mocks, addNode };
}

/** Shorthand — calls processEvent with the test controller. */
function dispatch(
  event: GraphRunEvent,
  controller: AppController,
  bridges: Map<string, NodeAgentBridge>
) {
  return processEvent(event, controller, bridges);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("processEvent", () => {
  let controller: AppController;
  let addNode: (id: string, title?: string, outputSchema?: object) => void;
  let bridges: Map<string, NodeAgentBridge>;

  beforeEach(() => {
    setDOM();
    const ctx = makeControllerWithGraph();
    controller = ctx.controller;
    addNode = ctx.addNode;
    bridges = new Map();
  });

  // --- nodeStart -----------------------------------------------------------

  suite("nodeStart", () => {
    test("creates console entry and sets working state", () => {
      addNode("n1", "Step One");

      const result = dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");
      const entry = controller.run.main.console.get("n1");
      assert.ok(entry, "console entry should exist");
      assert.strictEqual(entry.title, "Step One");

      const nodeState = controller.run.renderer.nodes.get("n1");
      assert.ok(nodeState);
      assert.strictEqual(nodeState.status, "working");

      // Bridge should have been created.
      assert.ok(bridges.has("n1"), "bridge should exist for node");
    });
  });

  // --- nodeEnd -------------------------------------------------------------

  suite("nodeEnd", () => {
    test("marks node as succeeded and cleans up bridge", () => {
      addNode("n1", "Step One");

      // Simulate nodeStart first to populate console entry.
      dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );

      const result = dispatch(
        { type: "nodeEnd", nodeId: "n1", index: 1 },
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");

      const entry = controller.run.main.console.get("n1");
      assert.ok(entry);
      assert.deepStrictEqual(entry.status, { status: "succeeded" });
      assert.strictEqual(entry.completed, true);

      const nodeState = controller.run.renderer.nodes.get("n1");
      assert.ok(nodeState);
      assert.strictEqual(nodeState.status, "succeeded");

      // Bridge should be cleaned up.
      assert.ok(!bridges.has("n1"), "bridge should be removed");
    });

    test("populates outputs from event when no bridge outcomes", () => {
      // The outputSchema must have an `items` with a `behavior` array
      // for toLLMContentArray to recognize the port as llm-content.
      addNode("n1", "Step One", {
        properties: {
          context: {
            type: "array",
            items: {
              behavior: ["llm-content"],
            },
          },
        },
      });

      // nodeStart to set up console entry.
      dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );

      // nodeEnd with outputs (non-agent path).
      const outputs = {
        context: [
          { role: "model", parts: [{ text: "Hello from text gen" }] },
        ],
      };
      dispatch(
        { type: "nodeEnd", nodeId: "n1", outputs, index: 1 },
        controller,
        bridges
      );

      const entry = controller.run.main.console.get("n1");
      assert.ok(entry);
      // Output should have been populated via toLLMContentArray.
      assert.ok(entry.output.size > 0, "outputs should be populated");
    });
  });

  // --- nodeError -----------------------------------------------------------

  suite("nodeError", () => {
    test("marks console entry as failed with error message", () => {
      addNode("n1", "Step One");

      // nodeStart to create the entry.
      dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );

      const result = dispatch(
        {
          type: "nodeError",
          nodeId: "n1",
          error: "TTS model rejected input",
          index: 2,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");

      const entry = controller.run.main.console.get("n1");
      assert.ok(entry, "console entry should still exist");
      assert.deepStrictEqual(entry.status, {
        status: "failed",
        errorMessage: "TTS model rejected input",
      });
      assert.deepStrictEqual(entry.error, {
        message: "TTS model rejected input",
      });
      assert.strictEqual(entry.completed, true);
    });

    test("sets renderer node state to failed", () => {
      addNode("n1", "Step One");

      dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );
      dispatch(
        {
          type: "nodeError",
          nodeId: "n1",
          error: "Bad request",
          index: 2,
        },
        controller,
        bridges
      );

      const nodeState = controller.run.renderer.nodes.get("n1");
      assert.ok(nodeState);
      assert.strictEqual(nodeState.status, "failed");
      if (nodeState.status === "failed") {
        assert.strictEqual(nodeState.errorMessage, "Bad request");
      }
    });

    test("cleans up bridge on error", () => {
      addNode("n1", "Step One");

      dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );
      assert.ok(bridges.has("n1"), "bridge should exist after nodeStart");

      dispatch(
        {
          type: "nodeError",
          nodeId: "n1",
          error: "Error",
          index: 2,
        },
        controller,
        bridges
      );
      assert.ok(!bridges.has("n1"), "bridge should be cleaned up after error");
    });

    test("handles nodeError when no prior nodeStart (no console entry)", () => {
      // nodeError without nodeStart — should not throw.
      const result = dispatch(
        {
          type: "nodeError",
          nodeId: "n1",
          error: "Unexpected error",
          index: 0,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");

      // Renderer should still be updated.
      const nodeState = controller.run.renderer.nodes.get("n1");
      assert.ok(nodeState);
      assert.strictEqual(nodeState.status, "failed");
    });
  });

  // --- graphComplete -------------------------------------------------------

  suite("graphComplete", () => {
    test("returns done", () => {
      const result = dispatch(
        {
          type: "graphComplete",
          sessionId: "sess-1",
          outputs: {},
          index: 0,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "done");
    });
  });

  // --- graphError ----------------------------------------------------------

  suite("graphError", () => {
    test("sets error on run controller and returns done", () => {
      const result = dispatch(
        {
          type: "graphError",
          sessionId: "sess-1",
          error: "Graph execution failed",
          index: 0,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "done");

      // The run controller should have the error set.
      const error = controller.run.main.error;
      assert.ok(error, "error should be set");
      assert.strictEqual(error.message, "Graph execution failed");
    });
  });

  // --- inputRequired -------------------------------------------------------

  suite("inputRequired", () => {
    test("returns suspend", () => {
      const result = dispatch(
        {
          type: "inputRequired",
          nodeId: "n1",
          interactionId: "int-1",
          index: 0,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "suspend");
    });
  });

  // --- unknown event -------------------------------------------------------

  suite("unknown event type", () => {
    test("returns continue for unrecognized events", () => {
      const result = dispatch(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "someFutureEvent", index: 0 } as any,
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");
    });
  });
});
