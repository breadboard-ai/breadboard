/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for the graph editing agent lifecycle.
 *
 * Replaces `GraphEditingAgentService` — the orchestration here
 * coordinates AgentService (Service) with GraphEditingAgentController
 * (Controller), which is exactly what Actions are for.
 */

import type { LLMContent } from "@breadboard-ai/types";
import { makeAction } from "../binder.js";
import { buildHooksFromSink } from "../../../a2/agent/loop-setup.js";
import { invokeGraphEditingAgent } from "../../../a2/agent/graph-editing/main.js";
import type { AgentRunHandle } from "../../../a2/agent/agent-service.js";
import type { A2ModuleFactory } from "../../../a2/runnable-module-factory.js";

export {
  bind,
  startGraphEditingAgent,
  resolveGraphEditingInput,
  resetGraphEditingAgent,
};

const bind = makeAction();

// ─── Module-level imperative state ──────────────────────────────────────────
// These are ephemeral coordination variables, not reactive state.
// They parallel the `bind` object itself — module-level singletons
// set during action execution.

/** The currently active run handle (null when no loop is running). */
let currentRun: AgentRunHandle | null = null;

/** Resolve callback for the pending `wait_for_user_input` promise. */
let pendingResolve: ((text: string) => void) | null = null;

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Start the graph editing agent loop with the user's first message.
 *
 * Creates a run via `AgentService`, wires consumer handlers to
 * `GraphEditingAgentController`, and invokes the agent loop with
 * sink-based hooks.
 */
function startGraphEditingAgent(firstMessage: string): void {
  const { controller, services } = bind;
  const agent = controller.editor.graphEditingAgent;
  if (agent.loopRunning) return;
  agent.loopRunning = true;

  const objective: LLMContent = {
    parts: [
      {
        text: `You are a graph editing assistant. The user's request is:\n\n${firstMessage}`,
      },
    ],
  };

  const factory = services.sandbox as A2ModuleFactory;

  // Abort any previous run
  currentRun?.abort();

  // Create a new run via AgentService
  const handle = services.agentService.startRun({
    kind: "graph-editing",
    objective,
  });
  currentRun = handle;

  // Wire consumer handlers to controller mutations
  handle.events
    .on("thought", (event) => {
      agent.addThought(event.text);
    })
    .on("functionCall", (event) => {
      const name = event.name;
      if (name !== "wait_for_user_input") {
        agent.addMessage("system", `${event.title ?? name}…`);
      }
    });

  // Build hooks from sink
  const hooks = buildHooksFromSink(handle.sink);

  // Bridge the "suspend" concept: the agent calls waitForInput,
  // which returns a Promise that resolves when the user sends
  // the next message via resolveGraphEditingInput.
  const waitForInput = (agentMessage: string): Promise<string> => {
    agent.addMessage("model", agentMessage);
    agent.waiting = true;
    agent.processing = false;
    return new Promise<string>((resolve) => {
      pendingResolve = resolve;
    });
  };

  const context = {
    fetchWithCreds: services.fetchWithCreds,
    currentStep: { id: "graph-editing", type: "graph-editing" },
    signal: handle.signal,
  };

  const moduleArgs = factory.createModuleArgs(context);

  invokeGraphEditingAgent(objective, moduleArgs, waitForInput, hooks)
    .then((result) => {
      agent.loopRunning = false;
      if (result && "$error" in result) {
        agent.addMessage("system", `Error: ${result.$error}`);
      }
      services.agentService.endRun(handle.runId);
      currentRun = null;
    })
    .catch((e) => {
      agent.loopRunning = false;
      agent.addMessage("system", `Error: ${(e as Error).message}`);
      services.agentService.endRun(handle.runId);
      currentRun = null;
    });
}

/**
 * Resolve the pending `wait_for_user_input` promise with user text.
 * Returns true if there was a pending resolve (agent was waiting).
 */
function resolveGraphEditingInput(text: string): boolean {
  if (!pendingResolve) return false;
  const resolve = pendingResolve;
  pendingResolve = null;
  const { controller } = bind;
  const agent = controller.editor.graphEditingAgent;
  agent.waiting = false;
  agent.processing = true;
  resolve(text);
  return true;
}

/**
 * Abort the current loop and reset all state.
 */
function resetGraphEditingAgent(): void {
  currentRun?.abort();
  currentRun = null;
  pendingResolve = null;
  const { controller } = bind;
  controller.editor.graphEditingAgent.reset();
}
