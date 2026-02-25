/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConsoleEntry,
  ErrorObject,
  InspectableNodePorts,
  NodeLifecycleState,
  NodeRunStatus,
  SimplifiedProjectRunState,
} from "@breadboard-ai/types";
import type {
  LLMContent,
  OutputResponse,
  Schema,
  WorkItem,
} from "@breadboard-ai/types";

import { CLIENT_DEPLOYMENT_CONFIG } from "../../../ui/config/client-deployment-configuration.js";
import { SnackType, STATUS } from "../../types.js";
import { getStepIcon } from "../../../ui/utils/get-step-icon.js";
import { makeAction, stopRun } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { Utils } from "../../utils.js";
import { RunController } from "../../controller/subcontrollers/run/run-controller.js";
import {
  onGraphVersionForSync,
  onNodeActionRequested,
  onRunStopped,
  onTopologyChange,
  onRunnerStart,
  onRunnerResume,
  onRunnerPause,
  onRunnerEnd,
  onRunnerError,
  onRunnerGraphStart,
  onRunnerNodeStart,
  onRunnerNodeEnd,
  onRunnerNodeStateChange,
  onRunnerEdgeStateChange,
  onRunnerOutput,
} from "./triggers.js";
import { edgeToString } from "../../../utils/graph-utils.js";
import { decodeErrorData } from "../../utils/decode-error.js";
import { createAppScreen, tickScreenProgress } from "../../utils/app-screen.js";
import { computeControlState } from "../../../utils/control.js";
import { toLLMContentArray } from "../../utils/common.js";
import {
  cleanupStoppedInput,
  dispatchRun,
  dispatchStop,
  handleInputRequested,
} from "./helpers/helpers.js";

export const bind = makeAction();

/**
 * Starts the current run.
 *
 * Uses `Exclusive` mode to prevent concurrent runs.
 *
 * Pre-populates the console with bound entries (with controller + id) BEFORE
 * calling runner.start(). This eliminates the race condition where
 * onGraphStartAction's async describe-awaiting could overwrite entries that
 * onNodeStartAction had already bound.
 *
 * @throws Error if no runner is set (programming error)
 */
export const start = asAction(
  "Run.start",
  ActionMode.Exclusive,
  async (): Promise<void> => {
    const { controller } = bind;
    const runController = controller.run.main;
    if (!runController.runner) {
      throw new Error("start() called without an active runner");
    }

    const runner = runController.runner;

    // Reset state before populating — same reset that onGraphStartAction used
    // to do, but now runs synchronously before any events fire.
    runController.reset();
    controller.run.renderer.reset();
    controller.run.screen.reset();

    // Flatten plan stages to get node IDs in execution order.
    const nodeIds: string[] = [];
    for (const stage of runner.plan?.stages ?? []) {
      for (const planNode of stage) {
        nodeIds.push(planNode.node.id);
      }
    }
    runController.setEstimatedEntryCount(nodeIds.length);

    // Pre-populate console with bound entries. The describes are awaited here
    // (safe because Exclusive mode isolates us) so metadata is fully settled
    // before any node starts running.
    const inspectable = controller.editor.graph.get()?.graphs.get("");
    if (inspectable) {
      const entries = await buildConsoleEntries(
        nodeIds,
        inspectable,
        () => "inactive",
        runController
      );
      for (const [nodeId, entry] of entries) {
        runController.setConsoleEntry(nodeId, entry);
      }
    }

    runner.start();
    // Note: Status will be updated by the trigger listening to runner events
  }
);

/**
 * Stops the current run by aborting it.
 *
 * Uses `Immediate` mode so it can be called anytime, including during triggers.
 */
export const stop = asAction(
  "Run.stop",
  ActionMode.Immediate,
  async (): Promise<void> => {
    stopRun(bind.controller);
  }
);

// =============================================================================
// Run Preparation
// =============================================================================

/**
 * Prepares a run by building the RunConfig, creating the HarnessRunner,
 * registering it on the service (for event forwarding), and setting it on
 * the controller.
 *
 * All configuration is pulled directly from the SCA bind (controller/services).
 * Wired to `onTopologyChange` so the runner is re-created whenever nodes are
 * added or removed, keeping the console in sync with the current graph.
 *
 * Skips re-preparation while a run is in progress — mid-run topology changes
 * are handled by `syncConsoleFromRunner` instead.
 */
export const prepare = asAction(
  "Run.prepare",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTopologyChange(bind),
  },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const logger = Utils.Logging.getLogger(controller);
    const LABEL = "Run Actions";

    // Don't re-prepare while a run is in progress.
    if (controller.run.main.status === STATUS.RUNNING) {
      return;
    }

    const graph = controller.editor.graph.editor?.raw();
    const url = controller.editor.graph.url;
    if (!graph || !url) {
      return;
    }

    const runConfig = {
      url,
      runner: graph,
      diagnostics: true as const,
      loader: services.loader,
      graphStore: controller.editor.graph,
      sandbox: services.sandbox,
      fetchWithCreds: services.fetchWithCreds,
      getProjectRunState: () =>
        ({
          console: controller.run.main.console,
          app: { screens: controller.run.screen.screens },
        }) as unknown as SimplifiedProjectRunState,
      clientDeploymentConfiguration: CLIENT_DEPLOYMENT_CONFIG,
      flags: bind.env.flags,
    };
    logger.log(
      Utils.Logging.Formatter.info(`Created run config for ${url}`),
      LABEL
    );

    // Create runner via service
    const { runner, abortController } =
      services.runService.createRunner(runConfig);

    // Register on service — this hooks up event forwarding to runnerEventBus.
    services.runService.registerRunner(runner);

    // Wire input lifecycle: when a console entry calls requestInputForNode,
    // notify the input queue to handle activation (bump screen, set input, etc.)
    controller.run.main.onInputRequested = (id, schema) =>
      handleInputRequested(id, schema, controller.run);

    // Set on controller
    controller.run.main.setRunner(runner, abortController);

    // Set status to stopped (ready to start)
    controller.run.main.setStatus(STATUS.STOPPED);

    // Pre-populate renderer node states from the orchestrator's initial state
    // so that the graph shows run buttons immediately.
    controller.run.renderer.reset();
    for (const [nodeId, nodeState] of runner.state) {
      const state = nodeState.state;
      controller.run.renderer.setNodeState(
        nodeId,
        state === "failed"
          ? { status: "failed", errorMessage: "" }
          : { status: state }
      );
    }

    // Pre-populate console with all graph nodes as "inactive" on initial load
    await syncConsoleFromRunner();
  }
);

// =============================================================================
// Runner Event-Triggered Actions
// =============================================================================
// Each runner event type gets its own triggered action, making it visible in
// the coordination registry, testable in isolation, and independently loggable.

/**
 * Module-level progress ticker handle, shared between onStart (creates it)
 * and onEnd/onError (clears it).
 */
let progressTickerHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Runner "start" — sets status to RUNNING and starts the progress ticker.
 */
export const onStart = asAction(
  "Run.onRunnerStart",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerStart(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const logger = Utils.Logging.getLogger(controller);
    const url = controller.editor.graph.url ?? "(unknown)";

    controller.run.main.setStatus(STATUS.RUNNING);
    logger.log(
      Utils.Logging.Formatter.verbose(`Runner started for ${url}`),
      "Run Actions"
    );

    // Start ticking progress every 250ms
    progressTickerHandle = setInterval(() => {
      for (const screen of controller.run.screen.screens.values()) {
        tickScreenProgress(screen);
      }
    }, 250);
  }
);

/**
 * Runner "resume" — sets status to RUNNING.
 */
export const onResume = asAction(
  "Run.onRunnerResume",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerResume(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.run.main.setStatus(STATUS.RUNNING);
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Runner resumed for ${controller.editor.graph.url ?? "(unknown)"}`
      ),
      "Run Actions"
    );
  }
);

/**
 * Runner "pause" — sets status to PAUSED.
 */
export const onPause = asAction(
  "Run.onRunnerPause",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerPause(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.run.main.setStatus(STATUS.PAUSED);
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Runner paused for ${controller.editor.graph.url ?? "(unknown)"}`
      ),
      "Run Actions"
    );
  }
);

/**
 * Runner "end" — sets status to STOPPED, clears ticker and input.
 */
export const onEnd = asAction(
  "Run.onRunnerEnd",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerEnd(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.run.main.setStatus(STATUS.STOPPED);
    if (progressTickerHandle) {
      clearInterval(progressTickerHandle);
      progressTickerHandle = null;
    }
    controller.run.main.clearInput();
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Runner ended for ${controller.editor.graph.url ?? "(unknown)"}`
      ),
      "Run Actions"
    );
  }
);

/**
 * Runner "error" — sets status to STOPPED, clears ticker, sets error + clears input.
 */
export const onError = asAction(
  "Run.onRunnerError",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerError(bind),
  },
  async (evt?: CustomEvent): Promise<void> => {
    const { controller } = bind;

    // Status + ticker cleanup
    controller.run.main.setStatus(STATUS.STOPPED);
    if (progressTickerHandle) {
      clearInterval(progressTickerHandle);
      progressTickerHandle = null;
    }

    // Extract error message from the event detail
    const detail = evt?.detail;
    const error = detail?.error;
    const message =
      typeof error === "string"
        ? error
        : ((error as { message?: string })?.message ?? "Unknown error");
    const details =
      typeof error === "object"
        ? (error as { details?: string })?.details
        : undefined;
    controller.run.main.setError({ message, details });
    controller.run.main.clearInput();

    // Show a persistent error snackbar so the user is notified.
    const actions = details
      ? [{ action: "details", title: "View details", value: details }]
      : [];
    controller.global.snackbars.snackbar(
      message,
      SnackType.ERROR,
      actions,
      true,
      globalThis.crypto.randomUUID(),
      true
    );

    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Runner error for ${controller.editor.graph.url ?? "(unknown)"}`
      ),
      "Run Actions"
    );
  }
);

/**
 * Runner "graphstart" — intentional no-op.
 *
 * Console pre-population and resets are handled by `start()` BEFORE
 * runner.start() fires events, so the graphstart handler no longer needs
 * to do any work. This eliminates the race condition where an async
 * describe callback could overwrite entries that onNodeStartAction had
 * already bound with a controller.
 */
export const onGraphStartAction = asAction(
  "Run.onGraphStart",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerGraphStart(bind),
  },
  // No-op: start() already reset controllers and populated entries.
  async (): Promise<void> => {}
);

/**
 * Runner "nodestart" — creates console entry, sets renderer state, creates screen.
 */
export const onNodeStartAction = asAction(
  "Run.onNodeStart",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerNodeStart(bind),
  },
  async (evt?: CustomEvent): Promise<void> => {
    const { controller } = bind;
    const detail = evt?.detail;

    if (!detail) return;

    const nodeId = detail.node.id;
    const inspectable = controller.editor.graph.get()?.graphs.get("");
    const node = inspectable?.nodeById(nodeId);
    const title = node?.title() ?? nodeId;
    const metadata = node?.currentDescribe()?.metadata ?? {};

    const entry = RunController.createConsoleEntry(title, "working", {
      icon: getStepIcon(metadata.icon, node?.currentPorts()),
      tags: metadata.tags,
      id: nodeId,
      controller: controller.run.main,
    });
    controller.run.main.setConsoleEntry(nodeId, entry);
    controller.run.renderer.setNodeState(nodeId, { status: "working" });

    // Create screen for this node (unless it should be skipped)
    const outputSchema = node?.currentDescribe()?.outputSchema;
    const controlState = computeControlState(detail.inputs ?? {});
    if (!controlState.skip) {
      const screen = createAppScreen(title, outputSchema);
      controller.run.screen.setScreen(nodeId, screen);
    }
  }
);

/**
 * Runner "nodeend" — updates console entry status, finalizes screen.
 */
export const onNodeEndAction = asAction(
  "Run.onNodeEnd",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerNodeEnd(bind),
  },
  async (evt?: CustomEvent): Promise<void> => {
    const { controller } = bind;
    const detail = evt?.detail;

    if (!detail) return;

    const nodeId = detail.node.id;
    const existing = controller.run.main.console.get(nodeId);
    if (existing) {
      const { outputs } = detail;
      const hasFailed = outputs && "$error" in outputs;

      if (hasFailed) {
        // Extract error message from the $error field.
        const errorData = outputs.$error;
        const message =
          typeof errorData === "string"
            ? errorData
            : ((errorData as { message?: string })?.message ?? "Unknown error");
        existing.error = { message };
      } else if (outputs) {
        // Populate the output map for completed step display.
        const inspectable = controller.editor.graph.get()?.graphs.get("");
        const node = inspectable?.nodeById(nodeId);
        const outputSchema = node?.currentDescribe()?.outputSchema ?? {};
        const { products } = toLLMContentArray(outputSchema as Schema, outputs);
        for (const [name, product] of Object.entries(products)) {
          existing.output.set(name, product as LLMContent);
        }
      }

      controller.run.main.setConsoleEntry(nodeId, {
        ...existing,
        status: hasFailed
          ? { status: "failed", errorMessage: existing.error!.message }
          : { status: "succeeded" },
        completed: true,
      });
      if (hasFailed) {
        controller.run.renderer.setNodeState(nodeId, {
          status: "failed",
          errorMessage: existing.error!.message,
        });
      } else {
        controller.run.renderer.setNodeState(nodeId, { status: "succeeded" });
      }
    }

    // Finalize or delete screen based on node state
    const nodeState = controller.run.main.runner?.state?.get(nodeId);
    if (nodeState?.state === "interrupted") {
      controller.run.screen.deleteScreen(nodeId);
    } else {
      controller.run.screen.screens.get(nodeId)?.finalize(detail);
    }
  }
);

/**
 * Runner "nodestatechange" — updates renderer node state.
 */
export const onNodeStateChangeAction = asAction(
  "Run.onNodeStateChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerNodeStateChange(bind),
  },
  async (evt?: CustomEvent): Promise<void> => {
    const { controller, services } = bind;
    const detail = evt?.detail;
    if (!detail) return;

    const { id, state, message } = detail;
    if (state === "failed") {
      const errorMessage =
        decodeErrorData(services.actionTracker, message as ErrorObject) ??
        "Unknown error";
      controller.run.renderer.setNodeState(id, {
        status: state,
        errorMessage: errorMessage.message,
      });
      return;
    }
    controller.run.renderer.setNodeState(id, { status: state });
  }
);

/**
 * Runner "edgestatechange" — updates renderer edge state.
 */
export const onEdgeStateChangeAction = asAction(
  "Run.onEdgeStateChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerEdgeStateChange(bind),
  },
  async (evt?: CustomEvent): Promise<void> => {
    const { controller } = bind;
    const detail = evt?.detail;
    if (!detail) return;

    const { edges, state } = detail;
    edges?.forEach(
      (edge: { from: string; to: string; out: string; in: string }) => {
        const edgeId = edgeToString(edge);
        controller.run.renderer.setEdgeState(edgeId, { status: state });
      }
    );
  }
);

/**
 * Runner "output" — writes to screen and console entry.
 */
export const onOutputAction = asAction(
  "Run.onOutput",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunnerOutput(bind),
  },
  async (evt?: CustomEvent): Promise<void> => {
    const { controller } = bind;
    const detail = evt?.detail as OutputResponse | undefined;
    if (!detail || !detail.bubbled) return;

    const nodeId = detail.node.id;

    // Write to screen (app view).
    controller.run.screen.screens.get(nodeId)?.addOutput(detail);

    // Write to console entry as a work item (console view live display).
    const entry = controller.run.main.console.get(nodeId);
    if (entry) {
      addOutputWorkItem(entry, detail);
    }
  }
);

// =============================================================================
// Console Sync
// =============================================================================

/**
 * Maps a NodeLifecycleState to a NodeRunStatus for console entries.
 * Note: NodeRunStatus excludes "failed" - failed nodes map to "succeeded"
 * as they are complete, with error styling handled via separate error state.
 */
export function mapLifecycleToRunStatus(
  state: NodeLifecycleState
): NodeRunStatus {
  switch (state) {
    case "inactive":
      return "inactive";
    case "ready":
      return "ready";
    case "working":
    case "waiting":
      return "working";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "succeeded";
    case "skipped":
      return "skipped";
    case "interrupted":
      return "interrupted";
    default:
      return "inactive";
  }
}

/**
 * Syncs the RunController's console entries from the runner's current state.
 *
 * This action is called when the graph topology changes during a run (e.g.,
 * the Planner replaces the graph via replaceWithTheme). It builds a new
 * console Map from runner.state in execution order and uses replaceConsole
 * for an atomic update that triggers reactivity.
 *
 * The trigger (registerGraphSyncTrigger) watches for graph version changes
 * and calls this action to perform the actual sync.
 */
export const syncConsoleFromRunner = asAction(
  "Run.syncConsoleFromRunner",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphVersionForSync(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const runController = controller.run.main;
    const graphController = controller.editor.graph;

    const runner = runController.runner;
    if (!runner) {
      return;
    }

    // Get nodes in execution order from runner.plan.stages
    const nodeIds: string[] = [];
    for (const stage of runner.plan?.stages ?? []) {
      for (const planNode of stage) {
        nodeIds.push(planNode.node.id);
      }
    }

    // Update estimated entry count
    runController.setEstimatedEntryCount(nodeIds.length);

    // Get the current graph for node metadata
    const graph = graphController.editor?.raw();
    if (!graph) {
      return;
    }

    const inspectable = controller.editor.graph.get()?.graphs.get("");
    if (!inspectable) {
      return;
    }

    // Build console entries with settled metadata and replace atomically.
    // All describes are awaited so that late-resolving callbacks can't
    // overwrite entries that onNodeStartAction has already bound.
    const newEntries = await buildConsoleEntries(
      nodeIds,
      inspectable,
      (nodeId) => {
        const nodeState = runner.state?.get(nodeId);
        return nodeState
          ? mapLifecycleToRunStatus(nodeState.state)
          : "inactive";
      }
    );

    // Replace the console atomically with new entries
    // This triggers @field signal due to reference change (immutable pattern)
    runController.replaceConsole(newEntries);
  }
);

/**
 * Re-prepares the runner after a run is stopped.
 *
 * Restores the behavior from the pre-SCA StopRoute (removed in 2bfbc6bf5)
 * which called prepare() after stop() to re-populate the console with
 * "inactive" entries.
 *
 * **Triggers:** `onRunStopped` — fires when stopVersion is bumped
 */
export const reprepareAfterStop = asAction(
  "Run.reprepareAfterStop",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onRunStopped(bind),
  },
  async (): Promise<void> => {
    await prepare();
  }
);

// =============================================================================
// Node Action
// =============================================================================

/**
 * Requests a node action (run/stop/runFrom/runNode).
 *
 * Sets the nodeActionRequest field on RunController, which triggers:
 * 1. Step.applyPendingEditsForNodeAction (priority 100) — flushes pending edits
 * 2. Run.executeNodeAction (priority 50) — dispatches the actual command
 */
export const handleNodeAction = asAction(
  "Run.handleNodeAction",
  { mode: ActionMode.Immediate },
  async (payload: {
    nodeId: string;
    actionContext?: "graph" | "step";
  }): Promise<void> => {
    const { nodeId, actionContext } = payload;
    if (!actionContext) {
      Utils.Logging.getLogger().log(
        Utils.Logging.Formatter.warning("Unknown action context"),
        "handleNodeAction"
      );
      return;
    }
    const { controller } = bind;
    controller.run.main.setNodeActionRequest({ nodeId, actionContext });
  }
);

/**
 * Executes a previously requested node action.
 *
 * Triggered by nodeActionRequest becoming non-null. Runs at priority 50
 * so that step-actions' applyPendingEditsForNodeAction (priority 100)
 * fires first, flushing any pending edits.
 *
 * **Triggers:**
 * - `onNodeActionRequested`: Fires when nodeActionRequest is set
 */
export const executeNodeAction = asAction(
  "Run.executeNodeAction",
  {
    mode: ActionMode.Immediate,
    priority: 50, // Lower than applyPendingEditsForNodeAction (100)
    triggeredBy: () => onNodeActionRequested(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const runController = controller.run.main;
    const request = runController.nodeActionRequest;
    if (!request) {
      return;
    }

    // Clear the request immediately so it doesn't re-trigger.
    runController.clearNodeActionRequest();

    const { nodeId, actionContext } = request;
    const runFromNode = actionContext === "graph";
    const runner = runController.runner;
    const nodeState = runner?.state?.get(nodeId);
    if (!nodeState) {
      Utils.Logging.getLogger().log(
        Utils.Logging.Formatter.warning(
          `Primary action: orchestrator state for node "${nodeId}" not found`
        ),
        "executeNodeAction"
      );
      return;
    }

    switch (nodeState.state) {
      case "inactive":
        break;

      case "ready":
      case "succeeded":
      case "failed":
      case "interrupted":
        runController.undismissError(nodeId);
        // runFrom bypasses start() → onGraphStartAction, so screens
        // must be cleared here to prevent stale insertion order from the
        // previous run surfacing the wrong "last" screen.
        if (runFromNode) {
          controller.run.screen.reset();
        }
        dispatchRun(runFromNode, nodeId, runner);
        break;

      case "working":
      case "waiting":
        controller.run.renderer.setNodeState(nodeId, {
          status: "interrupted",
        });
        cleanupStoppedInput(nodeId, controller.run);
        dispatchStop(nodeId, runner);
        break;

      case "skipped":
        Utils.Logging.getLogger().log(
          Utils.Logging.Formatter.warning(
            `Action event is invalid for "skipped" state`
          ),
          "executeNodeAction"
        );
        break;

      default:
        Utils.Logging.getLogger().log(
          Utils.Logging.Formatter.warning("Unknown state", nodeState.state),
          "executeNodeAction"
        );
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Minimal node shape needed by {@link buildConsoleEntries}.
 */
type DescribableNode = {
  title(): string;
  currentDescribe(): { metadata?: { icon?: string; tags?: string[] } };
  currentPorts(): InspectableNodePorts | undefined;
  describe(): Promise<{ metadata?: { icon?: string; tags?: string[] } }>;
};

/**
 * Minimal inspectable graph shape needed by {@link buildConsoleEntries}.
 */
type NodeLookup = {
  nodeById(id: string): DescribableNode | undefined;
};

/**
 * Builds console entries for a list of node IDs, resolving any pending
 * `describe()` calls before creating entries.
 *
 * This eliminates the fire-and-forget race where an async `describe()`
 * callback could overwrite a bound entry that `onNodeStartAction` had
 * already created.
 *
 * @param nodeIds - Ordered node identifiers
 * @param inspectable - Node lookup (from graph controller)
 * @param getStatus - Maps a nodeId to its run status
 */
async function buildConsoleEntries(
  nodeIds: string[],
  inspectable: NodeLookup,
  getStatus: (nodeId: string) => NodeRunStatus,
  runController?: RunController
): Promise<Map<string, ConsoleEntry>> {
  // Phase 1: collect sync metadata and queue async describes
  type NodeInfo = {
    nodeId: string;
    title: string;
    icon: string | undefined;
    tags: string[] | undefined;
    status: NodeRunStatus;
  };
  const infos: NodeInfo[] = [];
  const pendingDescribes: Promise<void>[] = [];

  for (const nodeId of nodeIds) {
    const node = inspectable.nodeById(nodeId);
    const title = node?.title() ?? nodeId;
    const metadata = node?.currentDescribe()?.metadata ?? {};
    const icon = getStepIcon(metadata.icon, node?.currentPorts());
    const status = getStatus(nodeId);

    const info: NodeInfo = { nodeId, title, icon, tags: metadata.tags, status };
    infos.push(info);

    // Queue an async describe when sync metadata doesn't include tags
    if (!metadata.tags && node) {
      pendingDescribes.push(
        node.describe().then((result) => {
          const { icon: asyncIcon, tags: asyncTags } = result.metadata || {};
          info.icon = getStepIcon(asyncIcon, node.currentPorts());
          info.tags = asyncTags;
        })
      );
    }
  }

  // Phase 2: wait for all describes to settle
  await Promise.all(pendingDescribes);

  // Phase 3: build entries from settled metadata
  // When a runController is provided, entries are created bound (with id +
  // controller) so that requestInput() works immediately.
  const entries = new Map<string, ConsoleEntry>();
  for (const { nodeId, title, icon, tags, status } of infos) {
    const entry = RunController.createConsoleEntry(title, status, {
      icon,
      tags,
      ...(runController ? { id: nodeId, controller: runController } : {}),
    });
    entries.set(nodeId, entry);
  }
  return entries;
}

// ═════════════════════════════════════════════════════════════════════════════

/**
 * Creates a WorkItem from an OutputResponse and adds it to the console entry.
 * This provides live output display in the console view while a step runs.
 */
function addOutputWorkItem(entry: ConsoleEntry, data: OutputResponse): void {
  const { node, outputs } = data;
  const { configuration = {}, metadata } = node;
  const { schema = {} } = configuration;
  const id = data.index;
  const title = metadata?.description || metadata?.title || "Output";
  const icon = metadata?.icon || "output";
  const { products } = toLLMContentArray(schema as Schema, outputs);

  const item: WorkItem = {
    title,
    icon,
    start: data.timestamp || performance.now(),
    end: null,
    elapsed: 0,
    awaitingUserInput: false,
    product: new Map(Object.entries(products) as [string, LLMContent][]),
  };

  entry.work.set(id, item);
  entry.current = item;
}
