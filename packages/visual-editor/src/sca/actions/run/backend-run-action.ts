/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Backend graph run action — consumes Heartstone SSE events and
 * maps them to the same RunController / RendererController state
 * that the in-process PlanRunner would set.
 *
 * On suspend (`inputRequired`), the SSE stream is closed.
 * After the user provides input, `:resume` is POSTed and a new
 * stream is opened — mirroring the sessions-backend pattern.
 *
 * Agent events are piped through per-node bridges that reuse the
 * same {@link registerProgressHandlers} shared with the sessions-
 * backend path in `invokeRemoteAgent()`.
 */

import type {
  AppScreen,
  AppScreenOutput,
  BehaviorSchema,
  ConsoleEntry,
  LLMContent,
  OutputValues,
  Schema,
} from "@breadboard-ai/types";
import type { GraphRunEvent } from "../../services/graph-run-service.js";
import { AgentEventConsumer } from "../../../a2/agent/agent-event-consumer.js";
import { addChatOutput } from "../../../a2/agent/chat-output.js";
import { ConsoleProgressManager } from "../../../a2/agent/console-progress-manager.js";
import { registerProgressHandlers } from "../../../a2/agent/register-progress-handlers.js";
import { RunController } from "../../controller/subcontrollers/run/run-controller.js";
import { STATUS } from "../../types.js";
import { getStepIcon } from "../../../ui/utils/get-step-icon.js";
import {
  createAppScreen,
  tickScreenProgress,
} from "../../utils/app-screen.js";
import { toLLMContentArray } from "../../utils/common.js";
import { makeAction } from "../binder.js";
import { Utils } from "../../utils.js";
import {
  handleInputRequested,
} from "./helpers/input-queue.js";

const LABEL = "Backend Run";

export { startBackendRun };

export const bind = makeAction();

// ---------------------------------------------------------------------------
// Abort-aware promise racing
// ---------------------------------------------------------------------------

/**
 * Races a promise against an AbortSignal. Rejects with an AbortError
 * if the signal fires before the promise settles. This ensures input
 * waits (which never reject on their own) don't hang the run forever
 * when the user clicks Stop/Restart.
 */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}

// ---------------------------------------------------------------------------
// Per-node agent bridge
// ---------------------------------------------------------------------------

/**
 * Tracks the AgentEventConsumer and progress state for a single node
 * so we can dispatch agent events to the correct consumer.
 *
 * Also captures the agent's `outcomes` from the `complete` event so
 * that `nodeEnd` can populate the console entry's output map.
 *
 * For input handling, `pendingInput` holds a Promise that resolves
 * when the user provides input via the UI. This bridges the gap
 * between the `waitForInput` agent event (which shows the UI) and
 * the `inputRequired` graph event (which triggers the resume flow).
 */
interface NodeAgentBridge {
  consumer: AgentEventConsumer;
  progress: ConsoleProgressManager;
  /** Captured from the `complete` agent event — the agent's final output. */
  outcomes?: LLMContent;
  /** Resolves with user input when `waitForInput` UI is completed. */
  pendingInput?: Promise<OutputValues>;
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

/**
 * Runs the current graph on the Heartstone backend via SSE.
 *
 * Lifecycle:
 * 1. POST graph → get session
 * 2. Open SSE stream → iterate events
 * 3. On `inputRequired`: close stream, wait for user input, POST :resume,
 *    reconnect
 * 4. Repeat until `graphComplete` or `graphError`
 *
 * Called from `runBoard()` in board-actions.ts, which is already inside
 * the `Board.onRun` Exclusive action. This is a plain function — NOT an
 * asAction — to avoid nested-exclusive deadlocks (same pattern as
 * `runner.start()`).
 */
async function startBackendRun(): Promise<void> {
  const { controller, services } = bind;
  const graphRunService = services.graphRunService;

  // Get the graph descriptor from the editor.
  const graph = controller.editor.graph.editor?.raw();
  if (!graph) {
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.warning("No graph to run"),
      LABEL
    );
    return;
  }

  // Reset state before starting.
  controller.run.main.reset();
  controller.run.renderer.reset();
  controller.run.screen.reset();
  controller.run.main.setStatus(STATUS.RUNNING);

  // Wire input lifecycle: when a console entry calls requestInputForNode,
  // notify the input queue to show the UI — same wiring as run-actions.ts.
  controller.run.main.onInputRequested = (id, schema, skipLabel) =>
    handleInputRequested(id, schema, controller.run, skipLabel);

  // Start ticking progress every 250ms — same as onRunnerStart.
  const progressTickerHandle = setInterval(() => {
    for (const screen of controller.run.screen.screens.values()) {
      tickScreenProgress(screen);
    }
  }, 250);

  const abortController = new AbortController();
  controller.run.main.abortController = abortController;

  // Per-node agent bridges for dispatching agent events.
  const bridges = new Map<string, NodeAgentBridge>();

  try {
    const session = await graphRunService.createSession(
      graph,
      abortController.signal
    );
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Session created: ${session.sessionId}`
      ),
      LABEL
    );

    // Main stream-consume loop — reconnects on suspend.
    let running = true;
    while (running) {
      const events = session.openStream(abortController.signal);

      for await (const event of events) {
        if (abortController.signal.aborted) {
          running = false;
          break;
        }

        const result = processEvent(event, controller, bridges);

        if (result === "done") {
          running = false;
          break;
        }

        if (result === "suspend") {
          // The `waitForInput` agent event (which arrived before this
          // `inputRequired` graph event) has already shown the input UI
          // and created a Promise on the bridge. We now:
          // 1. Wait for the user's response
          // 2. POST :resume with the response
          // 3. Break the inner loop so the outer loop reconnects

          const inputEvent = event as Extract<
            GraphRunEvent,
            { type: "inputRequired" }
          >;
          const bridge = bridges.get(inputEvent.nodeId);

          if (bridge?.pendingInput) {
            // Agent node path — the `waitForInput` handler already
            // showed the input UI and created a Promise on the bridge.
            Utils.Logging.getLogger(controller).log(
              Utils.Logging.Formatter.verbose(
                `Waiting for user input on node ${inputEvent.nodeId}`
              ),
              LABEL
            );

            const userInput = await raceAbort(
              bridge.pendingInput, abortController.signal
            );
            bridge.pendingInput = undefined;

            controller.run.main.setStatus(STATUS.RUNNING);
            await session.resume(inputEvent.interactionId, userInput);

            Utils.Logging.getLogger(controller).log(
              Utils.Logging.Formatter.verbose(
                `Resumed session after input on node ${inputEvent.nodeId}`
              ),
              LABEL
            );
          } else if (inputEvent.suspendEvent?.inputNode) {
            // Input node path — no agent involved. The backend built
            // the schema from the node's config (description, modality,
            // required). Use it directly.
            const inputNode = inputEvent.suspendEvent.inputNode as {
              schema?: Schema;
            };
            const schema: Schema = inputNode.schema &&
              (inputNode.schema as Schema).properties
              ? (inputNode.schema as Schema)
              : {
                  type: "object",
                  properties: {
                    request: {
                      type: "object",
                      title: "Please provide input",
                      behavior: [
                        "transient",
                        "llm-content",
                      ] as BehaviorSchema[],
                      format: "asterisk",
                    },
                  },
                };

            // If the schema's request title is empty or the generic
            // fallback, use the node's metadata title instead
            // (e.g. "Topic").
            const requestProp = schema.properties?.request;
            if (requestProp && !requestProp.title) {
              const inspectable = controller.editor.graph
                .get()
                ?.graphs.get("");
              const node = inspectable?.nodeById(inputEvent.nodeId);
              requestProp.title = node?.title() ?? "Please provide input";
            }

            const entry = controller.run.main.console.get(
              inputEvent.nodeId
            );
            if (entry) {
              // Show the prompt text as a chat bubble above the input
              // form — mirrors the `report()` call in the TS ask-user
              // module. The floating-input component doesn't render
              // the schema title itself.
              const promptTitle =
                schema.properties?.request?.title || "Please provide input";
              const appScreen = controller.run.screen.screens.get(
                inputEvent.nodeId
              );
              addChatOutput(
                { role: "model", parts: [{ text: promptTitle }] },
                entry,
                appScreen
              );

              Utils.Logging.getLogger(controller).log(
                Utils.Logging.Formatter.verbose(
                  `Input node ${inputEvent.nodeId} requesting input`
                ),
                LABEL
              );

              controller.run.main.setStatus(STATUS.PAUSED);
              const userInput = await raceAbort(
                entry.requestInput(schema), abortController.signal
              );

              controller.run.main.setStatus(STATUS.RUNNING);
              await session.resume(inputEvent.interactionId, userInput);

              Utils.Logging.getLogger(controller).log(
                Utils.Logging.Formatter.verbose(
                  `Resumed session after input node ${inputEvent.nodeId}`
                ),
                LABEL
              );
            } else {
              Utils.Logging.getLogger(controller).log(
                Utils.Logging.Formatter.warning(
                  `inputRequired for input node ${inputEvent.nodeId} but no console entry`
                ),
                LABEL
              );
              running = false;
            }
          } else {
            // Unknown suspend type — log and stop gracefully.
            Utils.Logging.getLogger(controller).log(
              Utils.Logging.Formatter.warning(
                `inputRequired but no handler for node ${inputEvent.nodeId}`
              ),
              LABEL
            );
            running = false;
          }

          // Break inner loop to reconnect stream.
          break;
        }
      }
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.verbose("Run aborted"),
        LABEL
      );
    } else {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(`Run failed: ${String(error)}`),
        LABEL
      );
      controller.run.main.setError({
        message: String(error),
      });
    }
  } finally {
    // Cleanup — mirrors onRunnerEnd.
    clearInterval(progressTickerHandle);
    bridges.clear();
    controller.run.main.clearInput();
    controller.run.main.setStatus(STATUS.STOPPED);
  }
}

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

type ProcessResult = "continue" | "done" | "suspend";

/**
 * Maps a single Heartstone SSE event to controller state updates.
 * Returns a control signal for the main loop.
 */
function processEvent(
  event: GraphRunEvent,
  controller: typeof bind.controller,
  bridges: Map<string, NodeAgentBridge>
): ProcessResult {
  switch (event.type) {
    case "nodeStart": {
      const { nodeId } = event;
      const inspectable = controller.editor.graph.get()?.graphs.get("");
      const node = inspectable?.nodeById(nodeId);
      const title = node?.title() ?? nodeId;
      const metadata = node?.currentDescribe()?.metadata ?? {};

      // Create console entry — same as handleNodeStart in run-actions.ts.
      const entry = RunController.createConsoleEntry(title, "working", {
        icon: getStepIcon(metadata.icon, node?.currentPorts()),
        tags: metadata.tags,
        id: nodeId,
        controller: controller.run.main,
      });
      controller.run.main.setConsoleEntry(nodeId, entry);
      controller.run.renderer.setNodeState(nodeId, { status: "working" });

      // Create app screen for this node.
      const outputSchema = node?.currentDescribe()?.outputSchema;
      const screen = createAppScreen(title, outputSchema);
      controller.run.screen.setScreen(nodeId, screen);

      // Create per-node agent bridge.
      const consoleEntry = controller.run.main.console.get(nodeId);
      const appScreen = controller.run.screen.screens.get(nodeId);
      createBridge(nodeId, consoleEntry, appScreen, controller, bridges);

      return "continue";
    }

    case "nodeEnd": {
      const { nodeId } = event;
      const bridge = bridges.get(nodeId);
      const existing = controller.run.main.console.get(nodeId);

      // Populate outputs: agent-mode nodes have bridge.outcomes from
      // agentEvent→complete; non-agent nodes (text gen, media gen) carry
      // outputs directly on the nodeEnd event.
      if (existing) {
        if (bridge?.outcomes) {
          existing.output.set("context", bridge.outcomes);
        } else if (event.outputs) {
          const inspectable = controller.editor.graph.get()?.graphs.get("");
          const node = inspectable?.nodeById(nodeId);
          const outputSchema = node?.currentDescribe()?.outputSchema ?? {};
          const { products } = toLLMContentArray(
            outputSchema as Schema,
            event.outputs as OutputValues
          );
          for (const [name, product] of Object.entries(products)) {
            existing.output.set(name, product as LLMContent);
          }
        }
      }

      if (existing) {
        controller.run.main.setConsoleEntry(nodeId, {
          ...existing,
          status: { status: "succeeded" },
          completed: true,
        });
      }
      controller.run.renderer.setNodeState(nodeId, { status: "succeeded" });

      // Finalize the screen — populate outputs and set status to
      // "complete", same as handleNodeEnd in run-actions.ts.
      const screen = controller.run.screen.screens.get(nodeId);
      if (screen) {
        if (bridge?.outcomes) {
          const inspectable = controller.editor.graph.get()?.graphs.get("");
          const node = inspectable?.nodeById(nodeId);
          const outputSchema = node?.currentDescribe()?.outputSchema;
          const output: AppScreenOutput = {
            output: { context: [bridge.outcomes] } as OutputValues,
            schema: outputSchema,
          };
          screen.outputs.set(nodeId, output);
          screen.last = output;
        } else if (event.outputs) {
          const inspectable = controller.editor.graph.get()?.graphs.get("");
          const node = inspectable?.nodeById(nodeId);
          const outputSchema = node?.currentDescribe()?.outputSchema;
          const output: AppScreenOutput = {
            output: event.outputs as OutputValues,
            schema: outputSchema,
          };
          screen.outputs.set(nodeId, output);
          screen.last = output;
        }
        screen.status = "complete";
      }

      // Clean up bridge.
      bridges.delete(nodeId);
      return "continue";
    }

    case "nodeError": {
      const { nodeId, error } = event;
      const existing = controller.run.main.console.get(nodeId);

      if (existing) {
        controller.run.main.setConsoleEntry(nodeId, {
          ...existing,
          status: { status: "failed", errorMessage: error },
          error: { message: error },
          completed: true,
        });
      }
      controller.run.renderer.setNodeState(nodeId, {
        status: "failed",
        errorMessage: error,
      });

      const screen = controller.run.screen.screens.get(nodeId);
      if (screen) {
        screen.status = "complete";
      }

      // Clean up bridge.
      bridges.delete(nodeId);
      return "continue";
    }

    case "agentEvent": {
      const bridge = bridges.get(event.nodeId);
      if (bridge) {
        // Dispatch the unwrapped AgentEvent through the consumer.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bridge.consumer.handle(event.event as any);
      }
      return "continue";
    }

    case "inputRequired": {
      // Signal the main loop to suspend and handle input.
      return "suspend";
    }

    case "graphComplete": {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.verbose(
          `Graph complete: ${event.sessionId}`
        ),
        LABEL
      );
      return "done";
    }

    case "graphError": {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(`Graph error: ${event.error}`),
        LABEL
      );
      controller.run.main.setError({
        message: event.error,
      });
      return "done";
    }

    default:
      return "continue";
  }
}

// ---------------------------------------------------------------------------
// Per-node bridge management
// ---------------------------------------------------------------------------

/**
 * Creates a per-node agent bridge and registers progress handlers.
 *
 * Also registers a `waitForInput` handler that bridges the frontend
 * input UI to the backend suspend/resume flow. When the agent emits
 * `waitForInput`, this handler:
 * 1. Calls `entry.requestInput(schema)` to show the input UI
 * 2. Stores the resulting Promise on the bridge as `pendingInput`
 * 3. When `inputRequired` arrives, the main loop awaits `pendingInput`,
 *    then POSTs `:resume` with the user's response
 */
function createBridge(
  nodeId: string,
  consoleEntry: ConsoleEntry | undefined,
  appScreen: AppScreen | undefined,
  controller: typeof bind.controller,
  bridges: Map<string, NodeAgentBridge>
): void {
  const consumer = new AgentEventConsumer();
  const progress = new ConsoleProgressManager(consoleEntry, appScreen);

  const bridge: NodeAgentBridge = { consumer, progress };

  registerProgressHandlers(consumer, progress, {
    onComplete: (result) => {
      // Capture outcomes for nodeEnd to use.
      bridge.outcomes = result.outcomes;
    },
    onError: (message) => {
      Utils.Logging.getLogger().log(
        Utils.Logging.Formatter.warning(
          `Agent error for ${nodeId}: ${message}`
        ),
        LABEL
      );
    },
  });

  // Register the waitForInput handler — this bridges the UI input
  // flow to the backend suspend/resume protocol.
  consumer.on("waitForInput", (event) => {
    const behaviors: BehaviorSchema[] = ["transient", "llm-content"];
    if (!event.skipLabel) {
      behaviors.push("hint-required");
    }
    const schema: Schema = {
      properties: {
        input: {
          type: "object",
          behavior: behaviors,
          format: event.inputType,
        },
      },
    };

    // Show the agent's prompt text in the console and app screen.
    addChatOutput(event.prompt, consoleEntry, appScreen);

    // requestInput shows the input UI and returns a Promise that
    // resolves when the user submits. Store it on the bridge for
    // the main loop to await when inputRequired arrives.
    const entry = controller.run.main.console.get(nodeId);
    if (entry) {
      bridge.pendingInput = entry.requestInput(schema, event.skipLabel);
    }

    // Return the Promise so the consumer knows this is a suspend event.
    return bridge.pendingInput;
  });

  bridges.set(nodeId, bridge);
}
