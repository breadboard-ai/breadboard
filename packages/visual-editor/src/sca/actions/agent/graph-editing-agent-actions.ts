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

import type {
  GraphMetadata,
  LLMContent,
  NodeConfiguration,
  NodeMetadata,
} from "@breadboard-ai/types";
import { generateImage, persistTheme } from "../theme/theme-utils.js";
import { createThemeGenerationPrompt } from "../../../ui/prompts/theme-generation.js";

import { ok } from "@breadboard-ai/utils";
import { asAction, ActionMode } from "../../coordination.js";
import { onGraphUrlChange } from "./triggers.js";
import { makeAction } from "../binder.js";
import { buildHooksFromSink } from "../../../a2/agent/loop-setup.js";
import { invokeGraphEditingAgent } from "../../../a2/agent/graph-editing/main.js";
import { buildGraphEditingFunctionGroups } from "../../../a2/agent/graph-editing/configurator.js";
import { EditingAgentPidginTranslator } from "../../../a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import type { AgentRunHandle } from "../../../a2/agent/agent-service.js";
import type { LocalAgentRun } from "../../../a2/agent/local-agent-run.js";
import type { A2ModuleFactory } from "../../../a2/runnable-module-factory.js";
import type { ChatResponse } from "../../../a2/agent/types.js";
import { UpdateNode } from "../../../ui/transforms/update-node.js";
import { layoutGraph } from "../../../a2/agent/graph-editing/layout-graph.js";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import type { ChatEntry } from "../../types.js";

export { bind, startGraphEditingAgent, resolveGraphEditingInput };

const bind = makeAction();

// ─── Module-level imperative state ──────────────────────────────────────────
// These are ephemeral coordination variables, not reactive state.
// They parallel the `bind` object itself — module-level singletons
// set during action execution.

/** The currently active run handle (null when no loop is running). */
let currentRun: AgentRunHandle | null = null;

/**
 * Resolve callback for the pending `waitForInput` suspend event.
 * The consumer handler creates this; `resolveGraphEditingInput` calls it.
 */
let pendingResolve: ((response: ChatResponse) => void) | null = null;

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

  // Create a new run via AgentService.
  // This action IS the agent loop, so it's always local mode.
  const handle = services.agentService.startRun({
    kind: "graph-editing",
    objective,
  }) as LocalAgentRun;
  currentRun = handle;

  const devtools = controller.editor.devtools?.opie;

  if (devtools) {
    devtools.clearLog();
    const translator = new EditingAgentPidginTranslator();
    const functionGroups = buildGraphEditingFunctionGroups({
      sink: handle.sink,
      translator,
    });
    const systemInstruction = functionGroups
      .map((g) => g.instruction)
      .filter((ins): ins is string => typeof ins === "string")
      .join("\n\n");
    const functionDeclarations = functionGroups.flatMap((g) => g.declarations);

    devtools.setSystemInstruction(systemInstruction);
    devtools.setFunctionDeclarations(functionDeclarations);
    devtools.addObjective(firstMessage);
  }

  handle.events
    .on("start", (event) => {
      const devtools = controller.editor.devtools?.opie;
      if (devtools && event.objective) {
        devtools.addObjective(event.objective);
      }
    })
    .on("thought", (event) => {
      agent.addThought(event.text);
      devtools?.addThought?.(event.text);
    })
    .on("functionCall", (event) => {
      const name = event.name;
      if (name !== "wait_for_user_input") {
        agent.addMessage("system", `${event.title ?? name}…`);
      }
      devtools?.addCall?.(event.callId, name, event.args);
    })
    .on("functionResult", (event) => {
      devtools?.updateCallResponse?.(event.callId, event.content);
    });

  // Build hooks from sink
  const hooks = buildHooksFromSink(handle.sink);

  // Register the suspend handler: when the agent calls `sink.suspend()`
  // with a `waitForInput` event, this handler sets UI state and returns
  // a Promise that resolves when the user sends the next message.
  handle.events.on("waitForInput", (event) => {
    // Extract the prompt text from the event
    const promptText = event.prompt.parts
      .filter((p): p is { text: string } => "text" in p)
      .map((p) => p.text)
      .join("\n");
    agent.addMessage("model", promptText);
    agent.waiting = true;
    agent.processing = false;
    return new Promise<ChatResponse>((resolve) => {
      pendingResolve = resolve;
    });
  });

  // Graph read: return the current graph structure
  handle.events.on("readGraph", () => {
    const { controller } = bind;
    const editor = controller.editor.graph.editor;
    if (!editor) {
      return Promise.resolve({ graph: { edges: [], nodes: [] } });
    }
    return Promise.resolve({ graph: editor.raw() });
  });

  // Graph write: apply edits or transforms and return success/failure
  handle.events.on("applyEdits", async (event) => {
    const { controller, services } = bind;
    const editor = controller.editor.graph.editor;
    if (!editor) {
      return { success: false, error: "No active graph to edit" };
    }

    if (event.edits) {
      // Raw EditSpec[] — apply directly
      const result = await editor.edit(event.edits, event.label);
      if (!result.success) {
        return { success: false, error: "Failed to apply edits" };
      }
      const isPositioning =
        (event.label && event.label.startsWith("Position")) ||
        (event.edits.length > 0 &&
          event.edits.every(
            (e) => e.type === "changemetadata" || e.type === "changeassetmetadata"
          ));
      if (isPositioning) {
        controller.editor.canvas.requestFitToView();
      }
      return { success: true };
    }

    if (event.transform) {
      // Transform descriptor — instantiate and apply
      const { transform } = event;
      switch (transform.kind) {
        case "updateNode": {
          const t = new UpdateNode(
            transform.nodeId,
            transform.graphId,
            transform.configuration as NodeConfiguration | null,
            transform.metadata as NodeMetadata | null,
            transform.portsToAutowire as InPort[] | null
          );
          const result = await editor.apply(t);

          // Side effect: trigger autoname if config changed
          if (transform.configuration) {
            controller.editor.graph.lastNodeConfigChange = {
              nodeId: transform.nodeId,
              graphId: transform.graphId,
              configuration: transform.configuration as NodeConfiguration,
              titleUserModified: t.titleUserModified,
            };
          }

          if (!result.success) {
            return { success: false, error: result.error };
          }
          return { success: true };
        }
        case "layoutGraph": {
          const graph = editor.raw();
          await layoutGraph(graph.nodes ?? [], graph.edges ?? []);
          controller.editor.canvas.requestFitToView();
          return { success: true };
        }
        case "updateGraphProperties": {
          const { title, description, themeIntent } = transform;

          let metadata: GraphMetadata | undefined;

          if (themeIntent) {
            const rawGraph = editor.raw();
            const promptTitle = title ?? rawGraph.title;
            const promptDesc = description ?? rawGraph.description;

            const appTheme = await generateImage(
              createThemeGenerationPrompt({
                random: false,
                title: promptTitle || "Application",
                description: promptDesc,
                userInstruction: themeIntent,
              }),

              handle.signal,
              controller,
              services
            );

            if (!ok(appTheme)) {
              return {
                success: false,
                error: `Theme generation failed: ${appTheme.$error}`,
              };
            }

            const graphThemeResult = await persistTheme(
              appTheme,
              controller,
              services
            );

            if (!ok(graphThemeResult)) {
              return {
                success: false,
                error: `Failed to persist theme: ${graphThemeResult.$error}`,
              };
            }

            metadata = editor.raw().metadata ?? {};
            metadata.visual ??= {};
            metadata.visual.presentation ??= {};
            metadata.visual.presentation.themes ??= {};

            const id = globalThis.crypto.randomUUID();
            metadata.visual.presentation.themes[id] = graphThemeResult;
            metadata.visual.presentation.theme = id;
          }

          const result = await editor.edit(
            [
              {
                type: "changegraphmetadata",
                title: title ?? undefined,
                description: description ?? undefined,
                metadata,
                graphId: "",
              },
            ],
            "Updating graph properties"
          );

          if (themeIntent) {
            controller.editor.theme.updateHash(controller.editor.graph.graph);
          }

          if (!result.success) {
            return { success: false, error: result.error };
          }
          return { success: true };
        }
      }
    }

    return { success: false, error: "Invalid applyEdits event" };
  });

  const context = {
    fetchWithCreds: services.fetchWithCreds,
    currentStep: { id: "graph-editing", type: "graph-editing" },
    signal: handle.signal,
  };

  const moduleArgs = factory.createModuleArgs(context);

  invokeGraphEditingAgent(objective, moduleArgs, handle.sink, hooks)
    .then((result) => {
      agent.loopRunning = false;
      agent.processing = false;
      agent.waiting = false;
      if (result && "$error" in result) {
        agent.addMessage("system", `Error: ${result.$error}`);
      }
      services.agentService.endRun(handle.runId);
      currentRun = null;
    })
    .catch((e) => {
      agent.loopRunning = false;
      agent.processing = false;
      agent.waiting = false;
      agent.addMessage("system", `Error: ${(e as Error).message}`);
      services.agentService.endRun(handle.runId);
      currentRun = null;
    });
}

/**
 * Resolve the pending `waitForInput` suspend event with user text.
 * Constructs a `ChatResponse` and resolves the consumer handler's Promise.
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
  resolve({ input: { parts: [{ text }] } });
  return true;
}

/**
 * Abort the current loop and reset all state.
 */
export const resetGraphEditingAgent = asAction(
  "GraphEditingAgent.reset",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphUrlChange(bind),
  },
  async (): Promise<void> => {
    currentRun?.abort();
    currentRun = null;
    pendingResolve = null;
    const { controller } = bind;
    controller.editor.graphEditingAgent.reset();
    controller.editor.devtools?.opie?.clearLog();
  }
);

let feedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

function formatConversation(entries: readonly ChatEntry[], n = 10): string {
  const lastN = entries.slice(-n);
  return lastN
    .map((entry) => {
      if (entry.kind === "message") {
        return `${entry.role.toUpperCase()}: ${entry.text}`;
      }
      if (entry.kind === "thought-group") {
        const thoughts = entry.thoughts
          .map((t) => `${t.title ?? "Thought"}: ${t.body}`)
          .join("\n");
        return `THOUGHTS:\n${thoughts}`;
      }
      return "";
    })
    .join("\n---\n");
}

export const setOpieReaction = asAction(
  "GraphEditingAgent.setOpieReaction",
  {
    mode: ActionMode.Immediate,
  },
  async (reaction: "up" | "down"): Promise<void> => {
    const { controller } = bind;
    const agent = controller.editor.graphEditingAgent;

    if (feedbackTimeoutId) {
      clearTimeout(feedbackTimeoutId);
      feedbackTimeoutId = null;
    }

    const currentReaction = agent.feedbackReaction;
    const newReaction = currentReaction === reaction ? "none" : reaction;
    agent.feedbackReaction = newReaction;

    if (newReaction !== "none") {
      feedbackTimeoutId = setTimeout(() => {
        const conversation = formatConversation(agent.entries, 10);
        const productData = {
          reaction: newReaction,
          conversation,
        };
        controller.global.feedback.open({
          bucketSuffix: "opie",
          productData,
          flow: "submit",
          description: `User sentiment: ${newReaction}`,
        });
      }, 3000);
    }
  }
);
