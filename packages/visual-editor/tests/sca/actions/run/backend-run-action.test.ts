/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, mock, suite, test } from "node:test";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { makeTestController } from "../../helpers/mock-controller.js";
import {
  processEvent,
  handleSuspend,
  type NodeEventBridge,
  type EventMode,
} from "../../../../src/sca/actions/run/backend-run-action.js";
import type { GraphRunEvent, GraphRunSession } from "../../../../src/sca/services/graph-run-service.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import { RunController } from "../../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { STATUS } from "../../../../src/sca/types.js";

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
  bridges: Map<string, NodeEventBridge>,
  mode: EventMode = "live"
) {
  return processEvent(event, controller, bridges, mode);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("processEvent", () => {
  let controller: AppController;
  let addNode: (id: string, title?: string, outputSchema?: object) => void;
  let bridges: Map<string, NodeEventBridge>;

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

  // --- thoughtEvent --------------------------------------------------------

  suite("thoughtEvent", () => {
    test("forwards thought text to bridge progress", () => {
      addNode("n1", "Step One");

      // nodeStart to create the bridge.
      dispatch(
        { type: "nodeStart", nodeId: "n1", index: 0 },
        controller,
        bridges
      );

      const bridge = bridges.get("n1");
      assert.ok(bridge, "bridge should exist after nodeStart");

      // Spy on progress.thought.
      const thoughtCalls: string[] = [];
      const originalThought = bridge.progress.thought.bind(bridge.progress);
      bridge.progress.thought = (text: string) => {
        thoughtCalls.push(text);
        return originalThought(text);
      };

      const result = dispatch(
        { type: "thoughtEvent", nodeId: "n1", text: "Thinking about layout...", index: 1 },
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");
      assert.strictEqual(thoughtCalls.length, 1);
      assert.strictEqual(thoughtCalls[0], "Thinking about layout...");
    });

    test("ignores thoughtEvent for unknown node", () => {
      // No nodeStart — no bridge exists.
      const result = dispatch(
        { type: "thoughtEvent", nodeId: "unknown", text: "Some thought", index: 0 },
        controller,
        bridges
      );

      assert.strictEqual(result, "continue");
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
    test("returns suspend in live mode", () => {
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

    test("returns continue and sets paused/waiting state in replay mode", () => {
      const result = dispatch(
        {
          type: "inputRequired",
          nodeId: "n1",
          interactionId: "int-1",
          index: 0,
        },
        controller,
        bridges,
        "replay"
      );

      assert.strictEqual(result, "continue");

      // Node should show as "waiting" (not spinning as "working").
      const nodeState = controller.run.renderer.nodes.get("n1");
      assert.ok(nodeState);
      assert.strictEqual(nodeState.status, "waiting");
    });
  });

  // --- graphCancelled ------------------------------------------------------

  suite("graphCancelled", () => {
    test("returns done", () => {
      const result = dispatch(
        {
          type: "graphCancelled",
          sessionId: "sess-1",
          index: 0,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "done");
    });
  });

  // --- replayComplete ------------------------------------------------------

  suite("replayComplete", () => {
    test("returns replayComplete", () => {
      const result = dispatch(
        {
          type: "replayComplete",
          index: 0,
        },
        controller,
        bridges
      );

      assert.strictEqual(result, "replayComplete");
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

// ---------------------------------------------------------------------------
// handleSuspend
// ---------------------------------------------------------------------------

/** Creates a mock GraphRunSession with a spied `resume`. */
function makeMockSession(): GraphRunSession & { resumeCalls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    sessionId: "test-session",
    resumeCalls: calls,
    async resume(interactionId: string, response: unknown) {
      calls.push([interactionId, response]);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openStream(): any {
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: undefined }),
        }),
      };
    },
    async cancel() {},
  };
}

suite("handleSuspend", () => {
  let controller: AppController;
  let addNode: (id: string, title?: string, outputSchema?: object) => void;
  let bridges: Map<string, NodeEventBridge>;

  beforeEach(() => {
    setDOM();
    const ctx = makeControllerWithGraph();
    controller = ctx.controller;
    addNode = ctx.addNode;
    bridges = new Map();
  });

  afterEach(() => {
    mock.restoreAll();
    unsetDOM();
  });

  /** Dispatch nodeStart to create a console entry for the node. */
  function setupNode(nodeId: string, title = nodeId) {
    addNode(nodeId, title);
    processEvent(
      { type: "nodeStart", nodeId, index: 0 },
      controller,
      bridges,
      "live"
    );
  }

  // --- early returns -------------------------------------------------------

  test("returns false when suspendEvent is undefined", async () => {
    setupNode("n1");

    const session = makeMockSession();
    const result = await handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-1",
        index: 1,
        // No suspendEvent.
      },
      controller,
      session,
      new AbortController()
    );

    assert.strictEqual(result, false);
    assert.strictEqual(session.resumeCalls.length, 0);
  });

  test("returns false when no console entry exists for nodeId", async () => {
    // Don't call setupNode — no entry.
    const session = makeMockSession();
    const result = await handleSuspend(
      {
        type: "inputRequired",
        nodeId: "unknown-node",
        interactionId: "int-1",
        suspendEvent: { inputNode: { schema: { properties: {} } } },
        index: 1,
      },
      controller,
      session,
      new AbortController()
    );

    assert.strictEqual(result, false);
    assert.strictEqual(session.resumeCalls.length, 0);
  });

  test("returns false for unrecognized suspendEvent type", async () => {
    setupNode("n1");

    const session = makeMockSession();
    const result = await handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-1",
        suspendEvent: { unknownType: { data: 123 } },
        index: 1,
      },
      controller,
      session,
      new AbortController()
    );

    assert.strictEqual(result, false);
    assert.strictEqual(session.resumeCalls.length, 0);
  });

  // --- inputNode -----------------------------------------------------------

  test("inputNode: calls requestInput and resumes session with user input", async () => {
    setupNode("n1", "Topic Input");

    const session = makeMockSession();
    const abortController = new AbortController();

    const suspendPromise = handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-abc",
        suspendEvent: {
          inputNode: {
            schema: {
              type: "object",
              properties: {
                request: {
                  type: "object",
                  title: "Enter topic",
                  behavior: ["transient", "llm-content"],
                },
              },
            },
          },
        },
        index: 1,
      },
      controller,
      session,
      abortController
    );

    // Status should transition to PAUSED while waiting.
    const runCtrl = controller.run.main as RunController;
    assert.strictEqual(runCtrl.status, STATUS.PAUSED);

    // Simulate user providing input.
    runCtrl.resolveInputForNode("n1", { request: "peanuts" });

    const result = await suspendPromise;

    assert.strictEqual(result, true);
    assert.strictEqual(runCtrl.status, STATUS.RUNNING);
    assert.strictEqual(session.resumeCalls.length, 1);
    assert.strictEqual(session.resumeCalls[0][0], "int-abc");
    assert.deepStrictEqual(session.resumeCalls[0][1], { request: "peanuts" });
  });

  test("inputNode: uses default schema when inputNode has no schema", async () => {
    setupNode("n1", "Bare Input");

    const session = makeMockSession();
    const abortController = new AbortController();

    const suspendPromise = handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-def",
        suspendEvent: { inputNode: {} },
        index: 1,
      },
      controller,
      session,
      abortController
    );

    // Should still be paused — requestInput was called with default schema.
    const runCtrl = controller.run.main as RunController;
    assert.strictEqual(runCtrl.status, STATUS.PAUSED);

    // Resolve with some default input.
    runCtrl.resolveInputForNode("n1", { request: "default value" });

    const result = await suspendPromise;
    assert.strictEqual(result, true);
    assert.strictEqual(session.resumeCalls.length, 1);
  });

  // --- waitForInput --------------------------------------------------------

  test("waitForInput: calls requestInput with agent schema and resumes", async () => {
    setupNode("n1", "Agent Node");

    const session = makeMockSession();
    const abortController = new AbortController();

    const suspendPromise = handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-wait",
        suspendEvent: {
          waitForInput: {
            requestId: "req-1",
            prompt: { role: "model", parts: [{ text: "What topic?" }] },
            inputType: "text",
            interactionId: "int-wait",
          },
        },
        index: 1,
      },
      controller,
      session,
      abortController
    );

    const runCtrl = controller.run.main as RunController;
    assert.strictEqual(runCtrl.status, STATUS.PAUSED);

    // Resolve input.
    runCtrl.resolveInputForNode("n1", {
      input: { parts: [{ text: "haiku about cats" }], role: "user" },
    });

    const result = await suspendPromise;
    assert.strictEqual(result, true);
    assert.strictEqual(runCtrl.status, STATUS.RUNNING);
    assert.strictEqual(session.resumeCalls.length, 1);
    assert.strictEqual(session.resumeCalls[0][0], "int-wait");
  });

  test("waitForInput: includes hint-required behavior when skipLabel is falsy", async () => {
    setupNode("n1", "Agent Node");

    const runCtrl = controller.run.main as RunController;

    // Capture the schema passed to requestInputForNode via callback.
    let capturedSchema: Record<string, unknown> | null = null;
    runCtrl.onInputRequested = (_id, schema) => {
      capturedSchema = schema as Record<string, unknown>;
    };

    const session = makeMockSession();
    handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-hint",
        suspendEvent: {
          waitForInput: {
            requestId: "req-2",
            prompt: { role: "model", parts: [{ text: "Prompt" }] },
            inputType: "edit_note",
            // skipLabel is undefined → should include hint-required
            interactionId: "int-hint",
          },
        },
        index: 1,
      },
      controller,
      session,
      new AbortController()
    );

    assert.ok(capturedSchema, "onInputRequested should have been called");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputProp = (capturedSchema as any).properties?.input;
    assert.ok(inputProp, "schema should have input property");
    const behaviors = inputProp.behavior as string[];
    assert.ok(
      behaviors.includes("hint-required"),
      "should include hint-required when skipLabel is falsy"
    );

    // Resolve to avoid dangling promise.
    runCtrl.resolveInputForNode("n1", { input: {} });
  });

  // --- abort ---------------------------------------------------------------

  test("rejects when aborted before user provides input", async () => {
    setupNode("n1");

    const session = makeMockSession();
    const abortController = new AbortController();

    const suspendPromise = handleSuspend(
      {
        type: "inputRequired",
        nodeId: "n1",
        interactionId: "int-abort",
        suspendEvent: {
          inputNode: {
            schema: { properties: { request: { type: "string" } } },
          },
        },
        index: 1,
      },
      controller,
      session,
      abortController
    );

    // Abort before user provides input.
    abortController.abort();

    await assert.rejects(suspendPromise);
    assert.strictEqual(
      session.resumeCalls.length,
      0,
      "should not resume when aborted"
    );
  });
});
