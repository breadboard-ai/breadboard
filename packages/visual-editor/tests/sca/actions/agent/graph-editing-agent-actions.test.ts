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
import type { WaitForInputEvent } from "../../../../src/a2/agent/agent-event.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function makeControllerStub(id: string) {
  const agent = new GraphEditingAgentController(
    id,
    "GraphEditingAgentController"
  );
  await agent.isHydrated;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { editor: { graphEditingAgent: agent } } as any;
}

function makeServicesStub() {
  return {
    sandbox: { createModuleArgs: () => ({}) },
    fetchWithCreds: globalThis.fetch,
    agentService: new AgentService(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

suite("graph-editing-agent-actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
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

    // Mock invokeGraphEditingAgent at module level — if it gets called,
    // the test should fail. We verify indirectly via the agentService.
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

    startGraphEditingAgent("Build something");

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

  // ── Consumer wiring ────────────────────────────────────────────────────────
  // These tests verify that the consumer handlers wire events to controller
  // mutations correctly. They create a run handle directly (bypassing the
  // real agent loop) and emit events through the sink.

  test("thought events are wired to controller", async () => {
    const controller = await makeControllerStub("GEA_act_7");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    // Create a run handle directly and wire it like the action does
    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });
    handle.events.on("thought", (event: { text: string }) => {
      agent.addThought(event.text);
    });

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

    services.agentService.endRun(handle.runId);
  });

  test("functionCall events add system messages for non-wait functions", async () => {
    const controller = await makeControllerStub("GEA_act_8");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    // Create a run handle directly and wire it like the action does
    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });
    handle.events.on(
      "functionCall",
      (event: { name: string; title?: string }) => {
        const name = event.name;
        if (name !== "wait_for_user_input") {
          agent.addMessage("system", `${event.title ?? name}…`);
        }
      }
    );

    // Non-wait function call → should add system message
    handle.sink.emit({
      type: "functionCall",
      callId: "call-1",
      name: "add_node",
      args: {},
      title: "Adding node",
    });

    // Wait function call → should NOT add system message
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

    services.agentService.endRun(handle.runId);
  });

  // ── Suspend/Resume (waitForInput) ─────────────────────────────────────────
  // These tests verify the event-driven suspend/resume flow.
  // They wire the waitForInput consumer handler directly (same approach as
  // the thought/functionCall tests above) rather than going through
  // startGraphEditingAgent which requires a full agent loop setup.

  test("waitForInput handler sets waiting state and adds model message", async () => {
    const controller = await makeControllerStub("GEA_act_9");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });

    // Wire the handler exactly as the action does
    handle.events.on("waitForInput", (event: WaitForInputEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts = event.prompt.parts as any[];
      const promptText = parts
        .filter((p) => "text" in p)
        .map((p) => p.text)
        .join("\n");
      agent.addMessage("model", promptText);
      agent.waiting = true;
      agent.processing = false;
      return new Promise(() => {
        // Intentionally don't resolve — we just test the UI state change
      });
    });

    // Trigger the suspend event
    handle.events.handle({
      type: "waitForInput",
      requestId: "req-1",
      prompt: { parts: [{ text: "What would you like me to do?" }] },
      inputType: "text",
    });

    await agent.isSettled;

    assert.strictEqual(agent.waiting, true, "Agent should be waiting");
    assert.strictEqual(
      agent.processing,
      false,
      "Agent should not be processing"
    );

    // Verify the model message was added
    const modelMessages = agent.entries.filter(
      (e: ChatEntry) => e.kind === "message" && e.role === "model"
    );
    assert.ok(
      modelMessages.length > 0,
      "Should have at least one model message"
    );
    if (modelMessages[0].kind === "message") {
      assert.ok(
        modelMessages[0].text.includes("What would you like me to do?")
      );
    }

    services.agentService.endRun(handle.runId);
  });

  test("waitForInput handler Promise resolves with ChatResponse", async () => {
    const controller = await makeControllerStub("GEA_act_10");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });

    let capturedResolve: ((v: unknown) => void) | null = null;
    handle.events.on("waitForInput", (event: WaitForInputEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts = event.prompt.parts as any[];
      const promptText = parts
        .filter((p) => "text" in p)
        .map((p) => p.text)
        .join("\n");
      agent.addMessage("model", promptText);
      agent.waiting = true;
      agent.processing = false;
      return new Promise<unknown>((resolve) => {
        capturedResolve = resolve;
      });
    });

    // Trigger suspend
    const resultPromise = handle.events.handle({
      type: "waitForInput",
      requestId: "req-2",
      prompt: { parts: [{ text: "Hello" }] },
      inputType: "text",
    }) as Promise<unknown>;

    assert.strictEqual(agent.waiting, true);
    assert.ok(
      capturedResolve !== null,
      "Should have captured the resolve callback"
    );

    // Resolve with a ChatResponse (same shape as resolveGraphEditingInput).
    // Assign to a local to avoid TS never-narrowing after assert.ok.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doResolve = capturedResolve as any;
    doResolve({ input: { parts: [{ text: "user says hi" }] } });

    const response = await resultPromise;
    assert.deepStrictEqual(response, {
      input: { parts: [{ text: "user says hi" }] },
    });

    services.agentService.endRun(handle.runId);
  });

  test("suspend round-trip via bridge: suspend → resolve → value returned", async () => {
    const controller = await makeControllerStub("GEA_act_11");
    const services = makeServicesStub();
    bind({ controller, services });
    const agent = controller.editor.graphEditingAgent;

    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });

    // Wire handler
    handle.events.on("waitForInput", () => {
      agent.waiting = true;
      agent.processing = false;
      return new Promise((resolve) => {
        // Simulate user responding after a tick
        setTimeout(() => {
          agent.waiting = false;
          agent.processing = true;
          resolve({ input: { parts: [{ text: "delayed reply" }] } });
        }, 10);
      });
    });

    // Use sink.suspend (the actual bridge path)
    const response = (await handle.sink.suspend({
      type: "waitForInput",
      requestId: "req-3",
      prompt: { parts: [{ text: "Waiting..." }] },
      inputType: "text",
    })) as { input: { parts: { text: string }[] } };

    assert.deepStrictEqual(response, {
      input: { parts: [{ text: "delayed reply" }] },
    });
    assert.strictEqual(agent.waiting, false);
    assert.strictEqual(agent.processing, true);

    services.agentService.endRun(handle.runId);
  });
});
