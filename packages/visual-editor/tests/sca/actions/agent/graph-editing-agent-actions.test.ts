/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, afterEach, beforeEach, mock } from "node:test";
import {
  bind,
  startGraphEditingAgent,
  resolveGraphEditingInput,
  resetGraphEditingAgent,
} from "../../../../src/sca/actions/agent/graph-editing-agent-actions.js";
import {
  GraphEditingAgentController,
  type ChatEntry,
} from "../../../../src/sca/controller/subcontrollers/editor/graph-editing-agent-controller.js";
import { AgentService } from "../../../../src/a2/agent/agent-service.js";
import type { AgentRunHandle } from "../../../../src/a2/agent/agent-service.js";

import { setDOM, unsetDOM } from "../../../fake-dom.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function makeControllerStub(id: string) {
  const agent = new GraphEditingAgentController(
    id,
    "GraphEditingAgentController"
  );
  await agent.isHydrated;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { editor: { graphEditingAgent: agent, graph: {} } } as any;
}

function makeServicesStub() {
  return {
    sandbox: { createModuleArgs: () => ({}) },
    fetchWithCreds: globalThis.fetch,
    agentService: new AgentService(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/**
 * Call startGraphEditingAgent and capture the run handle.
 *
 * The real `startGraphEditingAgent` calls `agentService.startRun()` then
 * wires handlers on the returned handle, then fires off
 * `invokeGraphEditingAgent(…).then(…).catch(…)` asynchronously.
 *
 * Since all handler wiring is synchronous and happens BEFORE the async
 * invoke, we can immediately emit events on the captured sink to exercise
 * the real handler code.
 *
 * The `invokeGraphEditingAgent` call will fail (because we pass dummy
 * module args) and the `.catch()` handler fires — which is also good:
 * it tests the error completion path (L206-211).
 */
function startAndCapture(
  services: ReturnType<typeof makeServicesStub>,
  message = "test"
): AgentRunHandle {
  let capturedHandle: AgentRunHandle | null = null;

  const origStartRun = services.agentService.startRun.bind(
    services.agentService
  );
  mock.method(
    services.agentService,
    "startRun",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (opts: any) => {
      capturedHandle = origStartRun(opts);
      return capturedHandle;
    }
  );

  startGraphEditingAgent(message);

  assert.ok(capturedHandle, "startRun should have been called");
  return capturedHandle;
}

// ── Tests ────────────────────────────────────────────────────────────────────

suite("graph-editing-agent-actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    // Always reset to clean up module-level state (currentRun, pendingResolve)
    try {
      resetGraphEditingAgent();
    } catch {
      // Ignore — reset may fail if bind wasn't called
    }
    mock.restoreAll();
    unsetDOM();
  });

  // ── resolveGraphEditingInput ──────────────────────────────────────────────

  test("resolveGraphEditingInput returns false when no pending resolve", async () => {
    const controller = await makeControllerStub("GEA_act_1");
    bind({ controller, services: makeServicesStub() });

    const result = resolveGraphEditingInput("hello");
    assert.strictEqual(result, false);
  });

  // ── resetGraphEditingAgent ────────────────────────────────────────────────

  test("resetGraphEditingAgent resets controller state", async () => {
    const controller = await makeControllerStub("GEA_act_2");
    bind({ controller, services: makeServicesStub() });
    const agent = controller.editor.graphEditingAgent;

    // Set some state
    agent.open = true;
    agent.loopRunning = true;
    agent.waiting = true;
    agent.processing = true;
    agent.currentFlow = "flow-1";
    agent.addMessage("user", "Hello");
    await agent.isSettled;

    resetGraphEditingAgent();
    await agent.isSettled;

    assert.deepStrictEqual(agent.entries, []);
    assert.strictEqual(agent.open, false);
    assert.strictEqual(agent.loopRunning, false);
    assert.strictEqual(agent.waiting, false);
    assert.strictEqual(agent.processing, false);
    assert.strictEqual(agent.currentFlow, null);
  });

  test("resetGraphEditingAgent is safe to call multiple times", async () => {
    const controller = await makeControllerStub("GEA_act_3");
    bind({ controller, services: makeServicesStub() });

    resetGraphEditingAgent();
    resetGraphEditingAgent();
    assert.ok(true, "Double reset did not throw");
  });

  // ── startGraphEditingAgent ────────────────────────────────────────────────

  test("startGraphEditingAgent is idempotent when loop is already running", async () => {
    const controller = await makeControllerStub("GEA_act_4");
    const services = makeServicesStub();
    bind({ controller, services });

    controller.editor.graphEditingAgent.loopRunning = true;
    await controller.editor.graphEditingAgent.isSettled;

    const startRunSpy = mock.method(services.agentService, "startRun");

    startGraphEditingAgent("test");

    assert.strictEqual(
      startRunSpy.mock.callCount(),
      0,
      "Should not start a run when loop is already running"
    );
  });

  test("startGraphEditingAgent sets loopRunning to true", async () => {
    const controller = await makeControllerStub("GEA_act_5");
    const services = makeServicesStub();
    bind({ controller, services });

    startAndCapture(services, "Build something");

    assert.strictEqual(controller.editor.graphEditingAgent.loopRunning, true);
  });

  test("startGraphEditingAgent creates a run via AgentService", async () => {
    const controller = await makeControllerStub("GEA_act_6");
    const services = makeServicesStub();
    bind({ controller, services });

    const startRunSpy = mock.method(services.agentService, "startRun");

    startGraphEditingAgent("Build something");

    assert.strictEqual(startRunSpy.mock.callCount(), 1);
    const callArgs = startRunSpy.mock.calls[0].arguments[0];
    assert.strictEqual(callArgs.kind, "graph-editing");
  });

  // ── Real handler: thought events (L91-93) ─────────────────────────────────

  test("thought handler: real handler adds thought to controller", async () => {
    const controller = await makeControllerStub("GEA_act_7");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = startAndCapture(services);

    // Emit through real sink → real handler fires at L92-93
    handle.sink.emit({ type: "thought", text: "**Analyzing** the graph" });
    await agent.isSettled;

    const thoughtGroup = agent.entries.find(
      (e: ChatEntry) => e.kind === "thought-group"
    );
    assert.ok(thoughtGroup, "Should have a thought group");
    if (thoughtGroup?.kind === "thought-group") {
      assert.strictEqual(thoughtGroup.thoughts.length, 1);
      assert.strictEqual(thoughtGroup.thoughts[0].title, "Analyzing");
    }
  });

  // ── Real handler: functionCall events (L95-99) ────────────────────────────

  test("functionCall handler: adds system message for non-wait functions", async () => {
    const controller = await makeControllerStub("GEA_act_8");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = startAndCapture(services);

    // Non-wait: should add system message (L98)
    handle.sink.emit({
      type: "functionCall",
      callId: "call-1",
      name: "add_node",
      args: {},
      title: "Adding node",
    });

    // Wait: should NOT add message (L97 guard)
    handle.sink.emit({
      type: "functionCall",
      callId: "call-2",
      name: "wait_for_user_input",
      args: {},
      title: undefined,
    });

    await agent.isSettled;

    const systemMessages = agent.entries.filter(
      (e: ChatEntry) => e.kind === "message" && e.role === "system"
    );
    assert.strictEqual(
      systemMessages.length,
      1,
      "Only non-wait functions should produce system messages"
    );
    if (systemMessages[0].kind === "message") {
      assert.ok(systemMessages[0].text.includes("Adding node"));
    }
  });

  test("functionCall handler: uses name when title is undefined", async () => {
    const controller = await makeControllerStub("GEA_act_9");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = startAndCapture(services);

    handle.sink.emit({
      type: "functionCall",
      callId: "call-1",
      name: "edit_graph",
      args: {},
    });
    await agent.isSettled;

    const systemMessages = agent.entries.filter(
      (e: ChatEntry) => e.kind === "message" && e.role === "system"
    );
    assert.strictEqual(systemMessages.length, 1);
    if (systemMessages[0].kind === "message") {
      assert.ok(systemMessages[0].text.includes("edit_graph"));
    }
  });

  // ── Real handler: waitForInput + resolveGraphEditingInput (L104-119, L219-228) ─

  test("waitForInput + resolve: real handler sets state and resolveGraphEditingInput resolves", async () => {
    const controller = await makeControllerStub("GEA_act_10");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = startAndCapture(services);

    // Trigger suspend → real waitForInput handler fires (L104-119)
    const responsePromise = handle.sink.suspend({
      type: "waitForInput",
      requestId: "req-1",
      prompt: { parts: [{ text: "What next?" }] },
      inputType: "text",
    });

    await agent.isSettled;

    // Real handler set state at L115-116
    assert.strictEqual(agent.waiting, true);
    assert.strictEqual(agent.processing, false);

    // Real handler added model message at L114
    const modelMessages = agent.entries.filter(
      (e: ChatEntry) => e.kind === "message" && e.role === "model"
    );
    assert.ok(modelMessages.length > 0);
    if (modelMessages[0].kind === "message") {
      assert.ok(modelMessages[0].text.includes("What next?"));
    }

    // Real resolveGraphEditingInput exercises L221-228
    const resolved = resolveGraphEditingInput("user reply");

    assert.strictEqual(resolved, true, "Should return true (L220)");
    assert.strictEqual(agent.waiting, false, "Should clear waiting (L225)");
    assert.strictEqual(agent.processing, true, "Should set processing (L226)");

    const response = await responsePromise;
    assert.deepStrictEqual(response, {
      input: { parts: [{ text: "user reply" }] },
    });
  });

  // ── Real handler: readGraph (L122-129) ─────────────────────────────────────

  test("readGraph handler returns empty graph when no editor (L126-127)", async () => {
    const controller = await makeControllerStub("GEA_act_11");
    const services = makeServicesStub();
    controller.editor.graph = { editor: null };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "readGraph",
      requestId: "rg-1",
    });

    assert.deepStrictEqual(result, { graph: { edges: [], nodes: [] } });
  });

  test("readGraph handler returns editor graph when available (L128-129)", async () => {
    const controller = await makeControllerStub("GEA_act_12");
    const services = makeServicesStub();
    const fakeGraph = {
      nodes: [{ id: "n1", type: "t" }],
      edges: [{ from: "n1", to: "n2", out: "o", in: "i" }],
    };
    controller.editor.graph = { editor: { raw: () => fakeGraph } };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "readGraph",
      requestId: "rg-2",
    });

    assert.deepStrictEqual(result, { graph: fakeGraph });
  });

  // ── Real handler: applyEdits (L131-186) ────────────────────────────────────

  test("applyEdits handler: no editor (L136-137)", async () => {
    const controller = await makeControllerStub("GEA_act_13");
    const services = makeServicesStub();
    controller.editor.graph = { editor: null };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "applyEdits",
      requestId: "ae-1",
      edits: [{ type: "addnode", graphId: "", node: { id: "x", type: "t" } }],
      label: "test",
    });

    assert.deepStrictEqual(result, {
      success: false,
      error: "No active graph to edit",
    });
  });

  test("applyEdits handler: raw edits success (L140-146)", async () => {
    const controller = await makeControllerStub("GEA_act_14");
    const services = makeServicesStub();
    const editSpy = mock.fn(async () => ({ success: true }));
    controller.editor.graph = { editor: { edit: editSpy, apply: mock.fn() } };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "applyEdits",
      requestId: "ae-2",
      edits: [{ type: "addnode", graphId: "", node: { id: "x", type: "t" } }],
      label: "Add node",
    });

    assert.strictEqual(editSpy.mock.callCount(), 1);
    assert.deepStrictEqual(result, { success: true });
  });

  test("applyEdits handler: raw edits failure (L143-144)", async () => {
    const controller = await makeControllerStub("GEA_act_15");
    const services = makeServicesStub();
    const editSpy = mock.fn(async () => ({
      success: false,
      error: "bad edit",
    }));
    controller.editor.graph = { editor: { edit: editSpy, apply: mock.fn() } };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "applyEdits",
      requestId: "ae-3",
      edits: [{ type: "addnode", graphId: "", node: { id: "x", type: "t" } }],
      label: "Fail",
    });

    assert.deepStrictEqual(result, {
      success: false,
      error: "Failed to apply edits",
    });
  });

  test("applyEdits handler: updateNode transform (L153-175)", async () => {
    const controller = await makeControllerStub("GEA_act_16");
    const services = makeServicesStub();
    const applySpy = mock.fn(async () => ({ success: true }));
    controller.editor.graph = {
      editor: { edit: mock.fn(), apply: applySpy },
      lastNodeConfigChange: null,
    };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "applyEdits",
      requestId: "ae-4",
      label: "Update node",
      transform: {
        kind: "updateNode",
        nodeId: "node-1",
        graphId: "main",
        configuration: { prompt: "hello" },
        metadata: null,
        portsToAutowire: null,
      },
    });

    assert.strictEqual(applySpy.mock.callCount(), 1);
    assert.deepStrictEqual(result, { success: true });

    // Autoname side effect (L166-173)
    assert.ok(controller.editor.graph.lastNodeConfigChange);
    assert.strictEqual(
      controller.editor.graph.lastNodeConfigChange.nodeId,
      "node-1"
    );
  });

  test("applyEdits handler: updateNode transform failure (L174-175)", async () => {
    const controller = await makeControllerStub("GEA_act_17");
    const services = makeServicesStub();
    const applySpy = mock.fn(async () => ({
      success: false,
      error: "transform failed",
    }));
    controller.editor.graph = {
      editor: { edit: mock.fn(), apply: applySpy },
    };
    bind({ controller, services });

    const handle = startAndCapture(services);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handle.sink.suspend({
      type: "applyEdits",
      requestId: "ae-5",
      label: "Update node",
      transform: {
        kind: "updateNode",
        nodeId: "node-1",
        graphId: "main",
        configuration: null,
        metadata: null,
        portsToAutowire: null,
      },
    });

    assert.deepStrictEqual(result, {
      success: false,
      error: "transform failed",
    });
  });

  test("applyEdits handler: invalid event (L185-186)", async () => {
    const controller = await makeControllerStub("GEA_act_18");
    const services = makeServicesStub();
    controller.editor.graph = {
      editor: { edit: mock.fn(), apply: mock.fn() },
    };
    bind({ controller, services });

    const handle = startAndCapture(services);

    const result = await (
      handle.sink.suspend as unknown as (
        event: Record<string, unknown>
      ) => Promise<unknown>
    ).call(handle.sink, {
      type: "applyEdits",
      requestId: "ae-6",
    });

    assert.deepStrictEqual(result, {
      success: false,
      error: "Invalid applyEdits event",
    });
  });

  // ── Completion handlers (.then/.catch on invokeGraphEditingAgent) ──────────
  // Since invokeGraphEditingAgent is the real implementation (not mocked),
  // it will try to call sink.suspend({ type: "readGraph" }) first.
  // If there's no readGraph handler or it fails, the invoke will reject
  // and the .catch (L206-211) fires. We test this by starting the agent
  // without readGraph returning properly.

  test("catch handler: error in invoke adds error message (L206-211)", async () => {
    const controller = await makeControllerStub("GEA_act_19");
    const services = makeServicesStub();
    // No editor or readGraph handler — invokeGraphEditingAgent will crash
    controller.editor.graph = { editor: null };
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    startAndCapture(services);

    // Wait for the invoke to fail and the .catch handler to fire
    await new Promise((r) => setTimeout(r, 200));
    await agent.isSettled;

    assert.strictEqual(agent.loopRunning, false, "Should reset loopRunning");
  });
});
