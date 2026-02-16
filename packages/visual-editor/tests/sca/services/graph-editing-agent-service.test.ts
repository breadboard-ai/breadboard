/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, afterEach, beforeEach } from "node:test";
import {
  GraphEditingAgentService,
  type InvokeFn,
} from "../../../src/sca/services/graph-editing-agent-service.js";
import {
  GraphEditingAgentController,
  type ChatEntry,
} from "../../../src/sca/controller/subcontrollers/editor/graph-editing-agent-controller.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";
import type { LLMContent, Outcome } from "@breadboard-ai/types";
import type { LoopHooks } from "../../../src/a2/agent/types.js";
import type { AgentResult } from "../../../src/a2/agent/loop.js";
import type { A2ModuleArgs } from "../../../src/a2/runnable-module-factory.js";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    sandbox: { createModuleArgs: () => ({}) },
    fetchWithCreds: globalThis.fetch,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Stub invoke that never resolves (keeps the loop alive). */
const neverResolve: InvokeFn = () => new Promise(() => {});

/** Create a stub invoke that returns a specific result. */
function stubInvoke(
  fn: (
    objective: LLMContent,
    moduleArgs: A2ModuleArgs,
    waitForInput: (msg: string) => Promise<string>,
    hooks?: LoopHooks
  ) => Promise<Outcome<AgentResult>>
): InvokeFn {
  return fn;
}

suite("GraphEditingAgentService", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  // ── resolveInput ──────────────────────────────────────────────────────────

  test("resolveInput returns false when no pending resolve", async () => {
    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_1");

    const result = service.resolveInput("hello", controller);
    assert.strictEqual(result, false);
  });

  // ── resetLoop ─────────────────────────────────────────────────────────────

  test("resetLoop resets controller state", async () => {
    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_2");
    const agent = controller.editor.graphEditingAgent;

    // Set some state
    agent.open = true;
    agent.loopRunning = true;
    agent.waiting = true;
    agent.processing = true;
    agent.currentFlow = "flow-1";
    agent.addMessage("user", "Hello");
    await agent.isSettled;

    service.resetLoop(controller);
    await agent.isSettled;

    assert.deepStrictEqual(agent.entries, []);
    assert.strictEqual(agent.open, false);
    assert.strictEqual(agent.loopRunning, false);
    assert.strictEqual(agent.waiting, false);
    assert.strictEqual(agent.processing, false);
    assert.strictEqual(agent.currentFlow, null);
  });

  test("resetLoop is safe to call multiple times", async () => {
    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_3");

    service.resetLoop(controller);
    service.resetLoop(controller);
    assert.ok(true, "Double resetLoop did not throw");
  });

  // ── startLoop ─────────────────────────────────────────────────────────────

  test("startLoop is idempotent when loop is already running", async () => {
    let invoked = false;
    const invoke: InvokeFn = async () => {
      invoked = true;
      return {} as Outcome<AgentResult>;
    };

    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_4");
    controller.editor.graphEditingAgent.loopRunning = true;
    await controller.editor.graphEditingAgent.isSettled;

    service.startLoop("test", controller, makeServicesStub(), invoke);

    assert.strictEqual(invoked, false, "Should not invoke when loop running");
  });

  test("startLoop sets loopRunning to true", async () => {
    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_5");

    service.startLoop(
      "Build something",
      controller,
      makeServicesStub(),
      neverResolve
    );

    assert.strictEqual(controller.editor.graphEditingAgent.loopRunning, true);
  });

  test("startLoop handles agent error result", async () => {
    const invoke: InvokeFn = async () =>
      ({ $error: "Something went wrong" }) as Outcome<AgentResult>;

    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_6");

    service.startLoop(
      "Build something",
      controller,
      makeServicesStub(),
      invoke
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const agent = controller.editor.graphEditingAgent;
    assert.strictEqual(agent.loopRunning, false);

    const lastEntry = agent.entries[agent.entries.length - 1];
    assert.strictEqual(lastEntry.kind, "message");
    if (lastEntry.kind === "message") {
      assert.strictEqual(lastEntry.role, "system");
      assert.ok(lastEntry.text.includes("Something went wrong"));
    }
  });

  test("startLoop handles thrown exception", async () => {
    const invoke: InvokeFn = async () => {
      throw new Error("Network failure");
    };

    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_7");

    service.startLoop(
      "Build something",
      controller,
      makeServicesStub(),
      invoke
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const agent = controller.editor.graphEditingAgent;
    assert.strictEqual(agent.loopRunning, false);

    const lastEntry = agent.entries[agent.entries.length - 1];
    assert.strictEqual(lastEntry.kind, "message");
    if (lastEntry.kind === "message") {
      assert.strictEqual(lastEntry.role, "system");
      assert.ok(lastEntry.text.includes("Network failure"));
    }
  });

  test("startLoop wires up waitForInput and resolveInput works", async () => {
    const invoke = stubInvoke(async (_obj, _args, waitForInput) => {
      const userReply = await waitForInput("What do you want?");
      return { result: userReply } as unknown as Outcome<AgentResult>;
    });

    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_8");

    service.startLoop(
      "Build something",
      controller,
      makeServicesStub(),
      invoke
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const agent = controller.editor.graphEditingAgent;

    assert.strictEqual(agent.waiting, true);
    assert.strictEqual(agent.processing, false);

    const modelMsg = agent.entries.find(
      (e: ChatEntry) => e.kind === "message" && e.role === "model"
    );
    assert.ok(modelMsg, "Should have model message from waitForInput");

    const resolved = service.resolveInput("my reply", controller);
    assert.strictEqual(resolved, true);
    assert.strictEqual(agent.waiting, false);
    assert.strictEqual(agent.processing, true);
  });

  test("hooks.onThought adds thoughts to controller", async () => {
    const invoke = stubInvoke(async (_obj, _args, _wait, hooks) => {
      hooks?.onThought?.("**Analyzing** the graph");
      hooks?.onThought?.("Looking at nodes");
      return {} as Outcome<AgentResult>;
    });

    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_9");

    service.startLoop("Test", controller, makeServicesStub(), invoke);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const agent = controller.editor.graphEditingAgent;
    const thoughtGroup = agent.entries.find(
      (e: ChatEntry) => e.kind === "thought-group"
    );
    assert.ok(thoughtGroup, "Should have a thought group");
    if (thoughtGroup?.kind === "thought-group") {
      assert.strictEqual(thoughtGroup.thoughts.length, 2);
      assert.strictEqual(thoughtGroup.thoughts[0].title, "Analyzing");
    }
  });

  test("hooks.onFunctionCall adds system message for non-wait functions", async () => {
    const invoke = stubInvoke(async (_obj, _args, _wait, hooks) => {
      hooks?.onFunctionCall?.(
        { functionCall: { name: "add_node", args: {} } },
        undefined,
        "Adding node"
      );
      hooks?.onFunctionCall?.(
        { functionCall: { name: "wait_for_user_input", args: {} } },
        undefined,
        undefined
      );
      return {} as Outcome<AgentResult>;
    });

    const service = new GraphEditingAgentService();
    const controller = await makeControllerStub("GEA_svc_10");

    service.startLoop("Test", controller, makeServicesStub(), invoke);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const agent = controller.editor.graphEditingAgent;
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
});
