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

import type { LLMContent, DataPart } from "@breadboard-ai/types";

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
import {
  GraphEditingManager,
  GraphThemeGenerator,
} from "../../../a2/agent/graph-editing/graph-editing-manager.js";
import {
  eventType,
  eventPayload,
  type AgentEvent,
  type Payload,
} from "../../../a2/agent/agent-event.js";

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
function startGraphEditingAgent(
  firstMessage: string,
  assets?: GraphAssetDescriptor[]
): void {
  const { controller, services } = bind;
  const productName =
    controller.global.onboarding.appMode === "lite" ? "Gem" : "Opal";
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

  if (assets && assets.length > 0) {
    objective.parts.push(
      ...assets.flatMap((a) => a.data.flatMap((d) => d.parts))
    );
  }

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
  agent.setHistory(handle.events.history);

  const devtools = controller.editor.devtools?.opie;
  const translator = new EditingAgentPidginTranslator();

  if (devtools) {
    devtools.clearLog();
    const functionGroups = buildGraphEditingFunctionGroups({
      sink: handle.sink,
      translator,
      productName,
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

    const themeGenerator: GraphThemeGenerator = async (ctx) => {
      const appTheme = await generateImage(
        createThemeGenerationPrompt({
          random: false,
          title: ctx.title,
          description: ctx.description,
          userInstruction: ctx.userInstruction,
        }),
        ctx.signal || handle.signal,
        controller,
        services
      );

      if (!ok(appTheme)) {
        return appTheme;
      }

      const graphThemeResult = await persistTheme(
        appTheme,
        controller,
        services
      );

      return graphThemeResult;
    };

    const manager = new GraphEditingManager(editor, themeGenerator);
    const result = await manager.applyEdits(event, {
      signal: handle.signal,
      onNodeConfigChanged: (ctx) => {
        controller.editor.graph.lastNodeConfigChange = ctx;
      },
      onThemeUpdated: () => {
        controller.editor.theme.updateHash(controller.editor.graph.graph);
        if (!controller.editor.step.focused) {
          controller.editor.sidebar.section = "preview";
        }
      },
    });

    const isPositioning =
      (event.label && event.label.startsWith("Position")) ||
      (event.edits &&
        event.edits.length > 0 &&
        event.edits.every(
          (e) => e.type === "changemetadata" || e.type === "changeassetmetadata"
        ));

    if (result.success && isPositioning) {
      controller.editor.canvas.requestFitToView();
    }

    return result;
  });

  const context = {
    fetchWithCreds: services.fetchWithCreds,
    currentStep: { id: "graph-editing", type: "graph-editing" },
    signal: handle.signal,
  };

  const moduleArgs = factory.createModuleArgs(context);

  invokeGraphEditingAgent(
    objective,
    moduleArgs,
    handle.sink,
    translator,
    hooks,
    productName
  )
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

import type { GraphAssetDescriptor } from "../../types.js";

/**
 * Resolve the pending `waitForInput` suspend event with user text.
 * Constructs a `ChatResponse` and resolves the consumer handler's Promise.
 * Returns true if there was a pending resolve (agent was waiting).
 */
function resolveGraphEditingInput(
  text: string,
  assets?: GraphAssetDescriptor[]
): boolean {
  if (!pendingResolve) return false;
  const resolve = pendingResolve;
  pendingResolve = null;
  const { controller } = bind;
  const agent = controller.editor.graphEditingAgent;
  agent.waiting = false;
  agent.processing = true;

  const parts: DataPart[] = [{ text }];
  if (assets && assets.length > 0) {
    parts.push(...assets.flatMap((a) => a.data.flatMap((d) => d.parts)));
  }

  resolve({ input: { parts } });
  return true;
}

/**
 * Abort the current loop and reset all state.
 *
 * When the workbench is active the conversation column is always
 * visible, so we immediately show a greeting after reset to avoid
 * an empty column.
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

    // In workbench mode the conversation is always visible — greet
    // immediately so the column is never empty after a graph change.
    const wb = controller.editor.workbench;
    if (wb.eligible && wb.view === "workbench") {
      controller.editor.graphEditingAgent.showGreeting();
    }
  }
);

let feedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

function formatLLMContent(content: LLMContent): string {
  if (!content || !content.parts) return "";
  return content.parts
    .map((part) => {
      if ("text" in part) {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatAgentEventHistory(
  events: ReadonlyArray<AgentEvent>,
  n = 20
): string {
  const lastN = events.slice(-n);
  return lastN
    .map((event) => {
      const type = eventType(event);
      const payload = eventPayload(event);

      switch (type) {
        case "start": {
          const p = payload as Payload<"start">;
          return `START OBJECTIVE:\n${formatLLMContent(p.objective)}`;
        }
        case "thought": {
          const p = payload as Payload<"thought">;
          return `THOUGHT:\n${p.text}`;
        }
        case "functionCall": {
          const p = payload as Payload<"functionCall">;
          return `CALL TOOL: ${p.name}\nArgs: ${JSON.stringify(p.args)}`;
        }
        case "functionResult": {
          const p = payload as Payload<"functionResult">;
          return `TOOL RESULT: ${formatLLMContent(p.content)}`;
        }
        case "content": {
          const p = payload as Payload<"content">;
          return `MODEL:\n${formatLLMContent(p.content)}`;
        }
        case "waitForInput": {
          const p = payload as Payload<"waitForInput">;
          return `WAIT FOR INPUT:\n${formatLLMContent(p.prompt)}`;
        }
        case "waitForChoice": {
          const p = payload as Payload<"waitForChoice">;
          const choicesStr = p.choices
            .map((c) => formatLLMContent(c.content))
            .join(" | ");
          return `WAIT FOR CHOICE:\n${formatLLMContent(p.prompt)}\nChoices: ${choicesStr}`;
        }
        case "applyEdits": {
          const p = payload as Payload<"applyEdits">;
          return `APPLY EDITS: ${p.label}`;
        }
        case "error": {
          const p = payload as Payload<"error">;
          return `ERROR: ${p.message}`;
        }
        case "complete": {
          const p = payload as Payload<"complete">;
          return `COMPLETE:\n${JSON.stringify(p.result)}`;
        }
        default:
          return `${type.toUpperCase()} EVENT`;
      }
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
        const events = agent.history;
        const conversation = formatAgentEventHistory(events, 20);
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
