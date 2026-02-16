/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import type { LoopHooks } from "../../a2/agent/types.js";
import type { A2ModuleFactory } from "../../a2/runnable-module-factory.js";
import type { AppServices } from "./services.js";
import type { AppController } from "../controller/controller.js";
import type { invokeGraphEditingAgent } from "../../a2/agent/graph-editing/main.js";

export { GraphEditingAgentService };
export type { InvokeFn };

type InvokeFn = typeof invokeGraphEditingAgent;

/**
 * Service managing the graph editing agent lifecycle.
 *
 * Owns imperative plumbing (AbortController, pending resolve callback)
 * that doesn't need to be reactive. Coordinates with the controller
 * for state mutations.
 */
class GraphEditingAgentService {
  #abortController: AbortController | null = null;
  #pendingResolve: ((text: string) => void) | null = null;

  /**
   * Start the agent loop with the user's first message.
   */
  startLoop(
    firstMessage: string,
    controller: AppController,
    services: AppServices,
    invoke: InvokeFn
  ): void {
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

    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const context = {
      fetchWithCreds: services.fetchWithCreds,
      currentStep: { id: "graph-editing", type: "graph-editing" },
      signal: this.#abortController.signal,
    };

    const moduleArgs = factory.createModuleArgs(context);

    const waitForInput = (agentMessage: string): Promise<string> => {
      agent.addMessage("model", agentMessage);
      agent.waiting = true;
      agent.processing = false;
      return new Promise<string>((resolve) => {
        this.#pendingResolve = resolve;
      });
    };

    const hooks: LoopHooks = {
      onThought: (text) => {
        agent.addThought(text);
      },
      onFunctionCall: (part, _icon, title) => {
        const name = part.functionCall.name;
        if (name !== "wait_for_user_input") {
          agent.addMessage("system", `${title ?? name}…`);
        }
        return { callId: crypto.randomUUID(), reporter: null };
      },
    };

    invoke(objective, moduleArgs, waitForInput, hooks)
      .then((result) => {
        agent.loopRunning = false;
        if (result && "$error" in result) {
          agent.addMessage("system", `Error: ${result.$error}`);
        }
      })
      .catch((e) => {
        agent.loopRunning = false;
        agent.addMessage("system", `Error: ${(e as Error).message}`);
      });
  }

  /**
   * Resolve the pending `wait_for_user_input` promise with user text.
   * Returns true if there was a pending resolve (agent was waiting).
   */
  resolveInput(text: string, controller: AppController): boolean {
    if (!this.#pendingResolve) return false;
    const resolve = this.#pendingResolve;
    this.#pendingResolve = null;
    const agent = controller.editor.graphEditingAgent;
    agent.waiting = false;
    agent.processing = true;
    resolve(text);
    return true;
  }

  /**
   * Abort the current loop and reset all state.
   */
  resetLoop(controller: AppController): void {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#pendingResolve = null;
    controller.editor.graphEditingAgent.reset();
  }
}
