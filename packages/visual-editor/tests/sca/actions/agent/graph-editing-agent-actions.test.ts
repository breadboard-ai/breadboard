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
  setOpieReaction,
} from "../../../../src/sca/actions/agent/graph-editing-agent-actions.js";
import { GraphEditingAgentController } from "../../../../src/sca/controller/subcontrollers/editor/graph-editing-agent-controller.js";
import { FeedbackController } from "../../../../src/sca/controller/subcontrollers/global/feedback-controller.js";
import type {
  ChatEntry,
  GraphAssetDescriptor,
} from "../../../../src/sca/types.js";
import type { ChatResponse } from "../../../../src/a2/agent/types.js";
import { DevToolsController } from "../../../../src/sca/controller/subcontrollers/editor/devtools/devtools-controller.js";
import {
  AgentService,
  type AgentRunHandle,
  type AgentRunConfig,
} from "../../../../src/a2/agent/agent-service.js";
import type { LocalAgentRun } from "../../../../src/a2/agent/local-agent-run.js";
import {
  type AgentEvent,
  type WaitForInputPayload,
} from "../../../../src/a2/agent/agent-event.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { GraphEditingManager } from "../../../../src/a2/agent/graph-editing/graph-editing-manager.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function makeControllerStub(id: string): Promise<AppController> {
  const agent = new GraphEditingAgentController(
    id,
    "GraphEditingAgentController"
  );
  const devtools = new DevToolsController(`${id}_dt`, "DevToolsController");
  await agent.isHydrated;
  await devtools.isHydrated;
  await devtools.opie.isHydrated;
  return {
    editor: {
      graphEditingAgent: agent,
      devtools,
      workbench: { eligible: false, view: "classic" },
    },
    global: { onboarding: { appMode: "canvas" } },
  } as unknown as AppController;
}

function makeServicesStub(): AppServices {
  return {
    sandbox: { createModuleArgs: () => ({}) },
    fetchWithCreds: globalThis.fetch,
    agentService: new AgentService(),
  } as unknown as AppServices;
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
    bind({
      controller,
      services: makeServicesStub(),
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const result = resolveGraphEditingInput("hello");
    assert.strictEqual(result, false);
  });

  // ── resetGraphEditingAgent ────────────────────────────────────────────────

  test("resetGraphEditingAgent resets controller state", async () => {
    const controller = await makeControllerStub("GEA_act_2");
    bind({
      controller,
      services: makeServicesStub(),
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    // Set some state
    agent.open = true;
    agent.loopRunning = true;
    agent.waiting = true;
    agent.processing = true;
    agent.addMessage("user", "Hello");
    const devtools = controller.editor.devtools;
    const opie = devtools.opie;
    opie.setSystemInstruction("Do this");
    opie.setFunctionDeclarations([
      { name: "test_func", description: "A test func" },
    ]);
    opie.addObjective("Hello");
    await agent.isSettled;
    await devtools.isSettled;

    resetGraphEditingAgent();
    await agent.isSettled;
    await devtools.isSettled;

    assert.deepStrictEqual(agent.entries, []);
    assert.strictEqual(agent.open, false);
    assert.strictEqual(agent.loopRunning, false);
    assert.strictEqual(agent.waiting, false);
    assert.strictEqual(agent.processing, false);

    assert.deepStrictEqual(opie.entries, []);
    assert.strictEqual(opie.systemInstruction, "");
    assert.deepStrictEqual(opie.functionDeclarations, []);
  });

  test("resetGraphEditingAgent is safe to call multiple times", async () => {
    const controller = await makeControllerStub("GEA_act_3");
    bind({
      controller,
      services: makeServicesStub(),
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    resetGraphEditingAgent();
    resetGraphEditingAgent();
    assert.ok(true, "Double reset did not throw");
  });

  // ── startGraphEditingAgent ────────────────────────────────────────────────

  test("startGraphEditingAgent is idempotent when loop is already running", async () => {
    const controller = await makeControllerStub("GEA_act_4");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

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
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    startGraphEditingAgent("Build something");

    assert.strictEqual(controller.editor.graphEditingAgent.loopRunning, true);
  });

  test("startGraphEditingAgent creates a run via AgentService", async () => {
    const controller = await makeControllerStub("GEA_act_6");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const startRunSpy = mock.method(services.agentService, "startRun");

    startGraphEditingAgent("Build something");

    assert.strictEqual(startRunSpy.mock.callCount(), 1);
    const callArgs = startRunSpy.mock.calls[0].arguments[0];
    assert.strictEqual(callArgs.kind, "graph-editing");
  });

  test("startGraphEditingAgent passes assets in objective parts", async () => {
    const controller = await makeControllerStub("GEA_act_assets");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const startRunSpy = mock.method(services.agentService, "startRun");

    const mockAssets: GraphAssetDescriptor[] = [
      {
        metadata: { title: "Test Asset", type: "file" },
        path: "asset-123.webp",
        data: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: "base64data",
                },
              },
            ],
          },
        ],
      },
    ];

    startGraphEditingAgent("Hello", mockAssets);

    assert.strictEqual(startRunSpy.mock.callCount(), 1);
    const callArgs = startRunSpy.mock.calls[0].arguments[0];
    if (callArgs && "objective" in callArgs) {
      assert.strictEqual(callArgs.objective.parts.length, 2);
      assert.deepStrictEqual(
        callArgs.objective.parts[1],
        mockAssets[0].data[0].parts[0]
      );
    } else {
      assert.fail("Expected local run config with objective");
    }
  });

  test("resolveGraphEditingInput with assets resolves with multimodal parts", async () => {
    const controller = await makeControllerStub("GEA_act_resolve_assets");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const originalStartRun = services.agentService.startRun.bind(
      services.agentService
    );
    let activeHandle: AgentRunHandle | null = null;
    mock.method(services.agentService, "startRun", (args: AgentRunConfig) => {
      const handle = originalStartRun(args);
      activeHandle = handle;
      return handle;
    });

    startGraphEditingAgent("Build something");

    const resultPromise = activeHandle!.events.handle({
      waitForInput: {
        requestId: "req-assets-1",
        prompt: { parts: [{ text: "Hello" }] },
        inputType: "text",
      },
    });

    const mockAssets: GraphAssetDescriptor[] = [
      {
        metadata: { title: "Test Asset", type: "file" },
        path: "asset-123.webp",
        data: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: "base64data",
                },
              },
            ],
          },
        ],
      },
    ];

    resolveGraphEditingInput("User response", mockAssets);

    const response = await resultPromise;
    assert.deepStrictEqual(response, {
      input: {
        parts: [{ text: "User response" }, mockAssets[0].data[0].parts[0]],
      },
    });

    services.agentService.endRun(activeHandle!.runId);
  });

  // ── Consumer wiring ────────────────────────────────────────────────────────
  // These tests verify that the consumer handlers wire events to controller
  // mutations correctly. They create a run handle directly (bypassing the
  // real agent loop) and emit events through the sink.

  test("thought events are wired to controller", async () => {
    const controller = await makeControllerStub("GEA_act_7");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    // Create a run handle directly and wire it like the action does
    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    }) as LocalAgentRun;
    handle.events.on("thought", (event: { text: string }) => {
      agent.addThought(event.text);
    });

    handle.sink.emit({ thought: { text: "**Analyzing** the graph" } });
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
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    // Create a run handle directly and wire it like the action does
    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    }) as LocalAgentRun;
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
      functionCall: {
        callId: "call-1",
        name: "add_node",
        args: {},
        title: "Adding node",
      },
    });

    // Wait function call → should NOT add system message
    handle.sink.emit({
      functionCall: {
        callId: "call-2",
        name: "wait_for_user_input",
        args: {},
        title: undefined,
      },
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
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });

    // Wire the handler exactly as the action does
    handle.events.on("waitForInput", (payload: WaitForInputPayload) => {
      const promptText = payload.prompt.parts
        .filter((p): p is { text: string } => "text" in p)
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
      waitForInput: {
        requestId: "req-1",
        prompt: { parts: [{ text: "What would you like me to do?" }] },
        inputType: "text",
      },
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
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    });

    let capturedResolve: ((v: ChatResponse) => void) | null = null;
    handle.events.on("waitForInput", (payload: WaitForInputPayload) => {
      const promptText = payload.prompt.parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n");
      agent.addMessage("model", promptText);
      agent.waiting = true;
      agent.processing = false;
      return new Promise<ChatResponse>((resolve) => {
        capturedResolve = resolve;
      });
    });

    // Trigger suspend
    const resultPromise = handle.events.handle({
      waitForInput: {
        requestId: "req-2",
        prompt: { parts: [{ text: "Hello" }] },
        inputType: "text",
      },
    }) as Promise<unknown>;

    assert.strictEqual(agent.waiting, true);
    capturedResolve!({ input: { parts: [{ text: "user says hi" }] } });

    const response = await resultPromise;
    assert.deepStrictEqual(response, {
      input: { parts: [{ text: "user says hi" }] },
    });

    services.agentService.endRun(handle.runId);
  });

  test("suspend round-trip via bridge: suspend → resolve → value returned", async () => {
    const controller = await makeControllerStub("GEA_act_11");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    const handle = services.agentService.startRun({
      kind: "graph-editing",
      objective: { parts: [{ text: "test" }] },
    }) as LocalAgentRun;

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
      waitForInput: {
        requestId: "req-3",
        prompt: { parts: [{ text: "Waiting..." }] },
        inputType: "text",
      },
    })) as { input: { parts: { text: string }[] } };

    assert.deepStrictEqual(response, {
      input: { parts: [{ text: "delayed reply" }] },
    });
    assert.strictEqual(agent.waiting, false);
    assert.strictEqual(agent.processing, true);

    services.agentService.endRun(handle.runId);
  });

  test("startGraphEditingAgent clears processing and waiting flags on failure", async () => {
    const controller = await makeControllerStub("GEA_act_12");
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
    const agent = controller.editor.graphEditingAgent;

    // Set initial busy state
    agent.processing = true;
    agent.waiting = true;
    await agent.isSettled;

    startGraphEditingAgent("Build something");

    // Wait for the background promise of invokeGraphEditingAgent to reject
    await new Promise((resolve) => setTimeout(resolve, 50));
    await agent.isSettled;

    assert.strictEqual(agent.loopRunning, false, "loopRunning should be false");
    assert.strictEqual(agent.processing, false, "processing should be false");
    assert.strictEqual(agent.waiting, false, "waiting should be false");
  });

  test("applyEdits updateTheme switches sidebar to preview when step is not focused", async () => {
    const controller = await makeControllerStub("GEA_act_13");
    const editorStub = controller.editor as unknown as {
      sidebar: { section: string };
      step: { focused: boolean };
      theme: { updateHash: (graph: unknown) => void };
      graph: {
        editor: { raw: () => { edges: unknown[]; nodes: unknown[] } };
        graph: { edges: unknown[]; nodes: unknown[] };
      };
    };
    editorStub.sidebar = { section: "editor" };
    editorStub.step = { focused: false };
    editorStub.theme = { updateHash() {} };
    editorStub.graph = {
      editor: {
        raw: () => ({ edges: [], nodes: [] }),
      },
      graph: { edges: [], nodes: [] },
    };

    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Mock GraphEditingManager.applyEdits to simulate a successful theme update
    mock.method(
      GraphEditingManager.prototype,
      "applyEdits",
      async (_payload: unknown, options: unknown) => {
        const opts = options as
          | { onThemeUpdated?: (metadata: unknown) => void }
          | undefined;
        if (opts?.onThemeUpdated) {
          opts.onThemeUpdated({});
        }
        return { success: true };
      }
    );

    const originalStartRun = services.agentService.startRun.bind(
      services.agentService
    );
    let activeHandle: AgentRunHandle | null = null;
    mock.method(services.agentService, "startRun", (args: AgentRunConfig) => {
      const handle = originalStartRun(args);
      activeHandle = handle;
      return handle;
    });

    startGraphEditingAgent("Build something");

    await activeHandle!.events.handle({
      applyEdits: {
        requestId: "req-theme-1",
        label: "Update theme",
        transform: {
          kind: "updateTheme",
          themeIntent: "sunset vibe",
        },
      },
    });

    assert.strictEqual(
      controller.editor.sidebar.section,
      "preview",
      "Sidebar should switch to preview when theme is updated and step is not focused"
    );

    services.agentService.endRun(activeHandle!.runId);
  });

  test("applyEdits updateTheme does not switch sidebar to preview when step is focused", async () => {
    const controller = await makeControllerStub("GEA_act_14");
    const editorStub = controller.editor as unknown as {
      sidebar: { section: string };
      step: { focused: boolean };
      theme: { updateHash: (graph: unknown) => void };
      graph: {
        editor: { raw: () => { edges: unknown[]; nodes: unknown[] } };
        graph: { edges: unknown[]; nodes: unknown[] };
      };
    };
    editorStub.sidebar = { section: "editor" };
    editorStub.step = { focused: true };
    editorStub.theme = { updateHash() {} };
    editorStub.graph = {
      editor: {
        raw: () => ({ edges: [], nodes: [] }),
      },
      graph: { edges: [], nodes: [] },
    };

    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    // Mock GraphEditingManager.applyEdits to simulate a successful theme update
    mock.method(
      GraphEditingManager.prototype,
      "applyEdits",
      async (_payload: unknown, options: unknown) => {
        const opts = options as
          | { onThemeUpdated?: (metadata: unknown) => void }
          | undefined;
        if (opts?.onThemeUpdated) {
          opts.onThemeUpdated({});
        }
        return { success: true };
      }
    );

    const originalStartRun = services.agentService.startRun.bind(
      services.agentService
    );
    let activeHandle: AgentRunHandle | null = null;
    mock.method(services.agentService, "startRun", (args: AgentRunConfig) => {
      const handle = originalStartRun(args);
      activeHandle = handle;
      return handle;
    });

    startGraphEditingAgent("Build something");

    await activeHandle!.events.handle({
      applyEdits: {
        requestId: "req-theme-2",
        label: "Update theme",
        transform: {
          kind: "updateTheme",
          themeIntent: "sunset vibe",
        },
      },
    });

    assert.strictEqual(
      controller.editor.sidebar.section,
      "editor",
      "Sidebar should NOT switch to preview when theme is updated and step is focused"
    );

    services.agentService.endRun(activeHandle!.runId);
  });

  // ── setOpieReaction ────────────────────────────────────────────────────────

  test("setOpieReaction sets feedback reaction and triggers feedback submission", async () => {
    const controller = await makeControllerStub("GEA_act_set_opie");
    controller.global.feedback = {
      open: mock.fn(),
    } as unknown as FeedbackController;
    const services = makeServicesStub();
    bind({
      controller,
      services,
      env: createMockEnvironment(defaultRuntimeFlags),
    });

    const agent = controller.editor.graphEditingAgent;

    // Start a dummy run to populate agent history
    const runConfig = {
      kind: "graph-editing",
      objective: { parts: [{ text: "test prompt" }] },
    };
    const handle = services.agentService.startRun(runConfig);
    agent.setHistory(handle.events.history);

    // Add some events to eventConsumer
    handle.events.handle({ start: { objective: { parts: [{ text: "test prompt" }] } } });
    handle.events.handle({ thought: { text: "Thinking about test prompt..." } });

    // Spy on setTimeout to capture the callback
    const setTimeoutCalls: { callback: () => void; delay: number }[] = [];
    mock.method(globalThis, "setTimeout", (callback: () => void, delay: number) => {
      setTimeoutCalls.push({ callback, delay });
      return 123 as unknown as ReturnType<typeof setTimeout>;
    });
    mock.method(globalThis, "clearTimeout", () => {});

    await setOpieReaction("up");

    assert.strictEqual(agent.feedbackReaction, "up");
    assert.strictEqual(setTimeoutCalls.length, 1);
    assert.strictEqual(setTimeoutCalls[0].delay, 3000);

    // Call the callback to trigger feedback.open
    setTimeoutCalls[0].callback();

    const openMock = controller.global.feedback.open as unknown as {
      mock: {
        callCount(): number;
        calls: Array<{
          arguments: [
            {
              bucketSuffix: string;
              flow: string;
              description: string;
              agentEvents: Array<ReadonlyArray<AgentEvent>>;
              productData: {
                reaction: string;
              };
            },
          ];
        }>;
      };
    };
    assert.strictEqual(openMock.mock.callCount(), 1);
    const args = openMock.mock.calls[0].arguments[0];
    assert.strictEqual(args.bucketSuffix, "opie");
    assert.strictEqual(args.flow, "submit");
    assert.strictEqual(args.description, "User sentiment: up");
    assert.strictEqual(args.productData.reaction, "up");
    assert.strictEqual(args.agentEvents.length, 1);
    assert.strictEqual(args.agentEvents[0].length, 2);
  });
});
