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
import type {
  GraphRunEvent,
  GraphRunSession,
} from "../../services/graph-run-service.js";
import { AgentEventConsumer } from "../../../a2/agent/agent-event-consumer.js";
import type {
  WaitForInputPayload,
  WaitForChoicePayload,
} from "../../../a2/agent/agent-event.js";
import { addChatOutput } from "../../../a2/agent/chat-output.js";
import { ChoicePresenter } from "../../../a2/agent/choice-presenter.js";
import { A2UIInteraction } from "../../../a2/agent/a2ui-interaction.js";
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
import type { AppController } from "../../controller/controller.js";
import { Utils } from "../../utils.js";
import {
  handleInputRequested,
} from "./helpers/input-queue.js";

const LABEL = "Backend Run";

export { startBackendRun, connectToSession, processEvent, handleSuspend };
export type { ProcessResult, NodeEventBridge, EventMode };

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
// Input-node suspend helper
// ---------------------------------------------------------------------------

/** The inputRequired event narrowed to its specific shape. */
type InputRequiredEvent = Extract<GraphRunEvent, { type: "inputRequired" }>;

/**
 * Default schema used when the backend's input node has no schema.
 */
const DEFAULT_INPUT_SCHEMA: Schema = {
  type: "object",
  properties: {
    request: {
      type: "object",
      title: "Please provide input",
      behavior: ["transient", "llm-content"] as BehaviorSchema[],
      format: "asterisk",
    },
  },
};

/**
 * Handles the suspend flow for any `inputRequired` event.
 *
 * Examines `suspendEvent` to determine what kind of input is needed:
 * - `inputNode`: form-based input from an input node
 * - `waitForInput`: text/edit input from an agent
 * - `waitForChoice`: multiple-choice selection from an agent
 *
 * Shows the appropriate UI in the side-nav, waits for the user's
 * response, and resumes the session.
 *
 * @returns `true` if input was collected and the session resumed,
 *          `false` if the suspend type is unrecognized.
 */
async function handleSuspend(
  inputEvent: InputRequiredEvent,
  controller: AppController,
  session: GraphRunSession,
  abortController: AbortController
): Promise<boolean> {
  const { suspendEvent } = inputEvent;
  if (!suspendEvent) return false;

  const entry = controller.run.main.console.get(inputEvent.nodeId);
  if (!entry) {
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.warning(
        `inputRequired for ${inputEvent.nodeId} but no console entry`
      ),
      LABEL
    );
    return false;
  }

  const appScreen = controller.run.screen.screens.get(inputEvent.nodeId);

  // Determine what to show and create the input Promise.
  let inputPromise: Promise<unknown> | undefined;

  if ("inputNode" in suspendEvent) {
    // Input node — form-based input.
    const inputNode = suspendEvent.inputNode as { schema?: Schema } | undefined;
    const schema: Schema =
      inputNode?.schema && (inputNode.schema as Schema).properties
        ? (inputNode.schema as Schema)
        : DEFAULT_INPUT_SCHEMA;

    // If the schema's request title is empty, use the node's metadata title.
    const requestProp = schema.properties?.request;
    if (requestProp && !requestProp.title) {
      const inspectable = controller.editor.graph.get()?.graphs.get("");
      const node = inspectable?.nodeById(inputEvent.nodeId);
      requestProp.title = node?.title() ?? "Please provide input";
    }

    const promptTitle =
      schema.properties?.request?.title || "Please provide input";
    addChatOutput(
      { role: "model", parts: [{ text: promptTitle }] },
      entry,
      appScreen
    );

    inputPromise = entry.requestInput(schema);
  } else if ("waitForInput" in suspendEvent) {
    // Agent text/edit input.
    const event = suspendEvent.waitForInput as WaitForInputPayload;
    addChatOutput(event.prompt, entry, appScreen);

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

    inputPromise = entry.requestInput(schema, event.skipLabel);
  } else if ("waitForChoice" in suspendEvent) {
    // Agent multiple-choice selection — use the same ChoicePresenter
    // that the A2 agent uses to render proper choice buttons.
    const event = suspendEvent.waitForChoice as WaitForChoicePayload;
    addChatOutput(event.prompt, entry, appScreen);

    const interaction = new A2UIInteraction(entry, appScreen);
    const choicePresenter = new ChoicePresenter(
      null as never, // translator unused — presentTranslatedChoices skips it
      interaction
    );

    inputPromise = choicePresenter.presentTranslatedChoices(
      event.prompt,
      event.choices,
      undefined, // surfaceId default
      event.selectionMode,
      event.noneOfTheAboveLabel
    );
  }

  if (!inputPromise) return false;

  controller.run.main.setStatus(STATUS.PAUSED);
  const userInput = await raceAbort(inputPromise, abortController.signal);

  controller.run.main.setStatus(STATUS.RUNNING);
  await session.resume(inputEvent.interactionId, userInput);

  Utils.Logging.getLogger(controller).log(
    Utils.Logging.Formatter.verbose(
      `Resumed session after suspend on ${inputEvent.nodeId}`
    ),
    LABEL
  );

  return true;
}

// ---------------------------------------------------------------------------
// Per-node event bridge
// ---------------------------------------------------------------------------

/**
 * Tracks the AgentEventConsumer and progress state for a single node
 * so we can dispatch agent events and thought events to the correct
 * consumer.
 *
 * Also captures the agent's `outcomes` from the `complete` event so
 * that `nodeEnd` can populate the console entry's output map.
 *
 * For input handling, `pendingInput` holds a Promise that resolves
 * when the user provides input via the UI. This bridges the gap
 * between the `waitForInput` agent event (which shows the UI) and
 * the `inputRequired` graph event (which triggers the resume flow).
 */
interface NodeEventBridge {
  consumer: AgentEventConsumer;
  progress: ConsoleProgressManager;
  /** Captured from the `complete` agent event — the agent's final output. */
  outcomes?: LLMContent;
  /** Resolves with user input when `waitForInput` UI is completed. */
  pendingInput?: Promise<OutputValues>;
}

// ---------------------------------------------------------------------------
// Shared run-state setup and event-loop helpers
// ---------------------------------------------------------------------------

/**
 * Common run-state initialization shared by `startBackendRun` and
 * `connectToSession`. Resets controllers, wires input lifecycle,
 * and starts the screen progress ticker.
 *
 * @returns A handle to clear the progress ticker in `finally`.
 */
function initRunState(controller: AppController): ReturnType<typeof setInterval> {
  controller.run.main.reset();
  controller.run.renderer.reset();
  controller.run.screen.reset();
  controller.run.main.setStatus(STATUS.RUNNING);

  controller.run.main.onInputRequested = (id, schema, skipLabel) =>
    handleInputRequested(id, schema, controller.run, skipLabel);

  return setInterval(() => {
    for (const screen of controller.run.screen.screens.values()) {
      tickScreenProgress(screen);
    }
  }, 250);
}

/** Options that differ between a fresh run and a session reconnect. */
interface ConsumeOptions {
  /** Start in replay mode — events before `replayComplete` are non-interactive. */
  replay?: boolean;
}

/**
 * Consumes events from a `GraphRunSession`, dispatching each through
 * `processEvent` and handling suspend/resume. This is the shared core
 * of both `startBackendRun` and `connectToSession`.
 *
 * The loop reconnects the SSE stream after every suspend/resume cycle
 * and runs until the session completes, errors, or is aborted.
 */
async function consumeSessionEvents(
  session: GraphRunSession,
  controller: AppController,
  abortController: AbortController,
  options: ConsumeOptions = {}
): Promise<void> {
  const bridges = new Map<string, NodeEventBridge>();
  let mode: EventMode = options.replay ? "replay" : "live";
  const modeGetter = () => mode;

  // Track the last inputRequired seen during replay — if the session
  // is still suspended, we need to show the input UI after replay.
  let pendingReplayInput: InputRequiredEvent | null = null;

  let running = true;
  while (running) {
    const events = session.openStream(abortController.signal);

    for await (const event of events) {
      if (abortController.signal.aborted) {
        running = false;
        break;
      }

      // ── Replay bookkeeping ──
      if (mode === "replay" && event.type === "inputRequired") {
        pendingReplayInput = event as InputRequiredEvent;
      }
      if (
        mode === "replay" &&
        pendingReplayInput &&
        (event.type === "nodeEnd" || event.type === "nodeError") &&
        event.nodeId === pendingReplayInput.nodeId
      ) {
        pendingReplayInput = null;
      }

      const result = processEvent(event, controller, bridges, mode, modeGetter);

      // ── Replay → live transition ──
      if (result === "replayComplete") {
        mode = "live";
        Utils.Logging.getLogger(controller).log(
          Utils.Logging.Formatter.verbose(
            `Replay complete — switching to live mode`
          ),
          LABEL
        );

        if (pendingReplayInput) {
          processEvent(pendingReplayInput, controller, bridges, "live", modeGetter);
          const handled = await handleSuspend(
            pendingReplayInput, controller, session, abortController
          );
          if (!handled) running = false;
          pendingReplayInput = null;
          break;
        }
        continue;
      }

      if (result === "done") {
        running = false;
        break;
      }

      if (result === "suspend") {
        const inputEvent = event as InputRequiredEvent;
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
        } else {
          // Input node or agent suspend without a bridge — the unified
          // handler reads suspendEvent to determine what UI to show.
          const handled = await handleSuspend(
            inputEvent, controller, session, abortController
          );
          if (!handled) running = false;
        }

        // Break inner loop to reconnect stream.
        break;
      }
    }
  }

  bridges.clear();
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

  const progressTickerHandle = initRunState(controller);
  const abortController = new AbortController();
  controller.run.main.abortController = abortController;

  try {
    // Extract the Drive file ID from the graph URL for session scoping.
    const graphUrl = controller.editor.graph.url;
    const graphId = graphUrl?.startsWith("drive:/")
      ? graphUrl.replace("drive:/", "")
      : "";
    if (!graphId) {
      throw new Error(
        "Backend graph runner requires a Drive-backed Opal (no graphId)"
      );
    }

    const session = await graphRunService.createSession(
      graph,
      graphId,
      abortController.signal
    );
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Session created: ${session.sessionId}`
      ),
      LABEL
    );

    // Track as the active session in the devtools sessions panel.
    controller.editor.devtools.sessionHistory.activeSessionId =
      session.sessionId;

    await consumeSessionEvents(session, controller, abortController);
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
    clearInterval(progressTickerHandle);
    controller.run.main.clearInput();
    controller.run.main.setStatus(STATUS.STOPPED);
  }
}

// ---------------------------------------------------------------------------
// Session reconnection
// ---------------------------------------------------------------------------

/**
 * Connects the graph UI to an existing backend session.
 *
 * The event stream is processed in two phases:
 * 1. **Replay** (events before `replayComplete`): builds up console
 *    entries, node states, and agent outputs without blocking on input.
 * 2. **Live** (events after `replayComplete`): normal interactive mode
 *    where `inputRequired` suspends and waits for user input.
 *
 * If the session has already completed, only the replay phase runs
 * and no `replayComplete` marker is emitted — the stream ends with
 * `graphComplete` / `graphError`.
 */
async function connectToSession(sessionId: string): Promise<void> {
  const { controller, services } = bind;
  const graphRunService = services.graphRunService;
  const sessionHistory = controller.editor.devtools.sessionHistory;

  // Cancel any existing connection.
  sessionHistory.connectionAbortController?.abort();

  const progressTickerHandle = initRunState(controller);
  const abortController = new AbortController();
  sessionHistory.connectionAbortController = abortController;
  sessionHistory.activeSessionId = sessionId;

  try {
    const session = graphRunService.connectSession(sessionId);

    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Connecting to session ${sessionId} (replay mode)`
      ),
      LABEL
    );

    await consumeSessionEvents(session, controller, abortController, {
      replay: true,
    });
  } catch (error) {
    if (!abortController.signal.aborted) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Session connection failed: ${String(error)}`
        ),
        LABEL
      );
      controller.run.main.setError({
        message: String(error),
      });
    }
  } finally {
    clearInterval(progressTickerHandle);
    controller.run.main.clearInput();
    controller.run.main.setStatus(STATUS.STOPPED);
    sessionHistory.connectionAbortController = null;
  }
}


// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

type ProcessResult = "continue" | "done" | "suspend" | "replayComplete";

/**
 * Controls how events are processed.
 * - `"live"`: normal interactive mode (suspend on inputRequired)
 * - `"replay"`: skip inputRequired, no interactive input
 */
type EventMode = "live" | "replay";

/**
 * Maps a single Heartstone SSE event to controller state updates.
 * Returns a control signal for the main loop.
 */
function processEvent(
  event: GraphRunEvent,
  controller: AppController,
  bridges: Map<string, NodeEventBridge>,
  mode: EventMode = "live",
  modeGetter?: () => EventMode
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
      createBridge(nodeId, consoleEntry, appScreen, controller, bridges, modeGetter ?? (() => mode));

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

    case "thoughtEvent": {
      const bridge = bridges.get(event.nodeId);
      if (bridge) {
        bridge.progress.thought(event.text);
      }
      return "continue";
    }

    case "inputRequired": {
      // In replay mode, don't suspend — input was already provided
      // (or the session is still suspended). But do update visual state
      // so the node shows as paused rather than spinning.
      if (mode === "replay") {
        controller.run.main.setStatus(STATUS.PAUSED);
        controller.run.renderer.setNodeState(event.nodeId, {
          status: "waiting",
        });
        return "continue";
      }
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

    case "graphCancelled": {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.verbose(
          `Graph cancelled: ${event.sessionId}`
        ),
        LABEL
      );
      return "done";
    }

    case "replayComplete": {
      return "replayComplete";
    }

    default:
      return "continue";
  }
}

// ---------------------------------------------------------------------------
// Per-node bridge management
// ---------------------------------------------------------------------------

/**
 * Creates a per-node event bridge and registers progress handlers.
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
  controller: AppController,
  bridges: Map<string, NodeEventBridge>,
  getMode: () => EventMode = () => "live"
): void {
  const consumer = new AgentEventConsumer();
  const progress = new ConsoleProgressManager(consoleEntry, appScreen);

  const bridge: NodeEventBridge = { consumer, progress };

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
    // Show the agent's prompt text in the console and app screen
    // (both replay and live — so conversation history is visible).
    addChatOutput(event.prompt, consoleEntry, appScreen);

    // In replay mode, don't show the input UI — input was already provided.
    if (getMode() === "replay") return undefined;

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

