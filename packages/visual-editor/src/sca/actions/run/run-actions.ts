/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConsoleEntry,
  ErrorObject,
  GraphDescriptor,
  HarnessRunner,
  NodeLifecycleState,
  NodeRunStatus,
  RunConfig,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "../../../data/file-system.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../../ui/config/client-deployment-configuration.js";
import { inputsFromSettings } from "../../../ui/data/inputs.js";
import type { SettingsStore } from "../../../ui/data/settings-store.js";
import { STATUS } from "../../../ui/types/types.js";
import { getStepIcon } from "../../../ui/utils/get-step-icon.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { Utils } from "../../utils.js";
import { RunController } from "../../controller/subcontrollers/run/run-controller.js";
import { onGraphVersionForSync, onNodeActionRequested } from "./triggers.js";
import { edgeToString } from "../../../ui/utils/workspace.js";
import { decodeErrorData } from "../../../ui/state/utils/decode-error.js";
import { ReactiveAppScreen } from "../../../ui/state/app-screen.js";
import { computeControlState } from "../../../runtime/control.js";
import {
  cleanupStoppedInput,
  dispatchRun,
  dispatchStop,
} from "./helpers/helpers.js";

export const bind = makeAction();

/**
 * Starts the current run.
 *
 * Uses `Exclusive` mode to prevent concurrent runs.
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
    runController.runner.start();
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
    const { controller } = bind;
    const runController = controller.run.main;
    if (runController.abortController) {
      runController.abortController.abort();
    }
    runController.setStatus(STATUS.STOPPED);
  }
);

// =============================================================================
// Run Preparation
// =============================================================================

/**
 * Callback to connect the runner to the project.
 * Called after runner is created, allowing Runtime to bridge to Project.
 */
export type ConnectToProjectCallback = (
  runner: HarnessRunner,
  abortSignal: AbortSignal
) => void;

/**
 * Configuration for preparing a run.
 */
export interface PrepareRunConfig {
  /** The graph to run */
  graph: GraphDescriptor;
  /** The URL of the graph */
  url: string;
  /** User settings (for inputs) */
  settings: SettingsStore;
  /** Credentials fetch function */
  fetchWithCreds: typeof fetch;
  /** Runtime flags */
  flags: RuntimeFlagManager;
  /** Callback to get project run state */
  getProjectRunState: RunConfig["getProjectRunState"];
  /**
   * Callback to connect runner to project (bridging Runtime to SCA).
   * @deprecated Remove once Project is moved into SCA structure.
   */
  connectToProject?: ConnectToProjectCallback;
}

/**
 * Prepares a run by building the RunConfig, creating the HarnessRunner,
 * and setting it on the controller.
 */
export const prepare = asAction(
  "Run.prepare",
  { mode: ActionMode.Immediate },
  async (config: PrepareRunConfig): Promise<void> => {
    const { controller, services } = bind;
    const logger = Utils.Logging.getLogger(controller);
    const LABEL = "Run Actions";

    const {
      graph,
      url,
      settings,
      fetchWithCreds,
      flags,
      getProjectRunState,
      connectToProject,
    } = config;

    // Build the fileSystem for this run
    const fileSystem = services.fileSystem.createRunFileSystem({
      graphUrl: url,
      env: envFromGraphDescriptor(services.fileSystem.env(), graph),
      assets: assetsFromGraphDescriptor(graph),
    });

    // Build the full RunConfig
    const runConfig: RunConfig = {
      url,
      runner: graph,
      diagnostics: true,
      loader: services.loader,
      graphStore: controller.editor.graph,
      sandbox: services.sandbox,
      fileSystem,
      // TODO: Remove this. Inputs from Settings is no longer a thing.
      inputs: inputsFromSettings(settings),
      fetchWithCreds,
      getProjectRunState,
      clientDeploymentConfiguration: CLIENT_DEPLOYMENT_CONFIG,
      flags,
    };
    logger.log(
      Utils.Logging.Formatter.info(`Created run config for ${url}`),
      LABEL
    );

    // Create runner via service
    const { runner, abortController } =
      services.runService.createRunner(runConfig);

    // Register status listeners on the runner
    runner.addEventListener("start", () => {
      controller.run.main.setStatus(STATUS.RUNNING);
      logger.log(
        Utils.Logging.Formatter.verbose(`Runner started for ${url}`),
        LABEL
      );
    });

    runner.addEventListener("resume", () => {
      controller.run.main.setStatus(STATUS.RUNNING);
      logger.log(
        Utils.Logging.Formatter.verbose(`Runner resumed for ${url}`),
        LABEL
      );
    });

    runner.addEventListener("pause", () => {
      controller.run.main.setStatus(STATUS.PAUSED);
      logger.log(
        Utils.Logging.Formatter.verbose(`Runner paused for ${url}`),
        LABEL
      );
    });

    runner.addEventListener("end", () => {
      controller.run.main.setStatus(STATUS.STOPPED);
      logger.log(
        Utils.Logging.Formatter.verbose(`Runner ended for ${url}`),
        LABEL
      );
    });

    runner.addEventListener("error", () => {
      controller.run.main.setStatus(STATUS.STOPPED);
      logger.log(
        Utils.Logging.Formatter.verbose(`Runner error for ${url}`),
        LABEL
      );
    });

    runner.addEventListener("error", (event) => {
      const error = event.data?.error;
      const message =
        typeof error === "string"
          ? error
          : ((error as { message?: string })?.message ?? "Unknown error");
      controller.run.main.setError({ message });
      controller.run.main.clearInput();
    });

    runner.addEventListener("end", () => {
      controller.run.main.clearInput();
    });

    runner.addEventListener("graphstart", (event) => {
      // Only reset for top-level graph
      if (event.data.path.length === 0) {
        controller.run.main.resetOutput();
        controller.run.renderer.reset();
        controller.run.screen.reset();

        // Use runner.plan.stages for execution-ordered iteration
        // Flatten stages to get nodes in execution order
        const nodeIds: string[] = [];
        for (const stage of runner.plan?.stages ?? []) {
          for (const planNode of stage) {
            nodeIds.push(planNode.node.id);
          }
        }

        controller.run.main.setEstimatedEntryCount(nodeIds.length);

        // Pre-populate console with all graph nodes as "inactive" in execution order
        const inspectable = controller.editor.graph.get()?.graphs.get("");
        if (inspectable) {
          for (const nodeId of nodeIds) {
            const node = inspectable?.nodeById(nodeId);
            const title = node?.title() ?? nodeId;
            const metadata = node?.currentDescribe()?.metadata ?? {};
            const icon = getStepIcon(metadata.icon, node?.currentPorts());

            const entry = RunController.createConsoleEntry(title, "inactive", {
              icon,
              tags: metadata.tags,
            });
            controller.run.main.setConsoleEntry(nodeId, entry);

            // If metadata wasn't ready (no tags), async fetch full describe
            if (!metadata.tags && node) {
              node.describe().then((result) => {
                const { icon: asyncIcon, tags: asyncTags } =
                  result.metadata || {};
                const resolvedIcon = getStepIcon(
                  asyncIcon,
                  node.currentPorts()
                );
                const updatedEntry = RunController.createConsoleEntry(
                  title,
                  "inactive",
                  {
                    icon: resolvedIcon,
                    tags: asyncTags,
                  }
                );
                controller.run.main.setConsoleEntry(nodeId, updatedEntry);
              });
            }
          }
        }
      }
    });

    runner.addEventListener("nodestart", (event) => {
      // Only handle top-level nodes
      if (event.data.path.length > 1) return;

      const nodeId = event.data.node.id;
      const inspectable = controller.editor.graph.get()?.graphs.get("");
      const node = inspectable?.nodeById(nodeId);
      const title = node?.title() ?? nodeId;
      const metadata = node?.currentDescribe()?.metadata ?? {};

      const entry = RunController.createConsoleEntry(title, "working", {
        icon: getStepIcon(metadata.icon, node?.currentPorts()),
        tags: metadata.tags,
      });
      controller.run.main.setConsoleEntry(nodeId, entry);
      controller.run.renderer.setNodeState(nodeId, { status: "working" });

      // Create screen for this node (unless it should be skipped)
      const outputSchema = node?.currentDescribe()?.outputSchema;
      const controlState = computeControlState(event.data.inputs ?? {});
      if (!controlState.skip) {
        const screen = new ReactiveAppScreen(title, outputSchema);
        controller.run.screen.setScreen(nodeId, screen);
      }
    });

    // Handle nodeend - update console entry status to succeeded
    runner.addEventListener("nodeend", (event) => {
      // Only handle top-level nodes
      if (event.data.path.length > 1) return;

      const nodeId = event.data.node.id;
      const existing = controller.run.main.console.get(nodeId);
      if (existing) {
        controller.run.main.setConsoleEntry(nodeId, {
          ...existing,
          status: { status: "succeeded" },
          completed: true,
        });
        controller.run.renderer.setNodeState(nodeId, { status: "succeeded" });
      }

      // Finalize or delete screen based on node state
      const nodeState = controller.run.main.runner?.state?.get(nodeId);
      if (nodeState?.state === "interrupted") {
        controller.run.screen.deleteScreen(nodeId);
      } else {
        controller.run.screen.screens.get(nodeId)?.finalize(event.data);
      }
    });

    // ── Renderer state ────────────────────────────────────────────────────

    runner.addEventListener("nodestatechange", (event) => {
      const { id, state, message } = event.data;
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
    });

    runner.addEventListener("edgestatechange", (event) => {
      const { edges, state } = event.data;
      edges?.forEach((edge) => {
        const edgeId = edgeToString(edge);
        controller.run.renderer.setEdgeState(edgeId, { status: state });
      });
    });

    // ── Screen output ─────────────────────────────────────────────────────

    runner.addEventListener("output", (event) => {
      if (!event.data.bubbled) return;
      const nodeId = event.data.node.id;
      controller.run.screen.screens.get(nodeId)?.addOutput(event.data);
    });

    // Set on controller
    controller.run.main.setRunner(runner, abortController);

    // Connect to project if callback provided
    if (connectToProject) {
      connectToProject(runner, abortController.signal);
    }

    // Set status to stopped (ready to start)
    controller.run.main.setStatus(STATUS.STOPPED);

    // Pre-populate console with all graph nodes as "inactive" on initial load
    await syncConsoleFromRunner();
  }
);

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

    // Build console entries in a regular Map first
    const newEntries = new Map<string, ConsoleEntry>();

    for (const nodeId of nodeIds) {
      const node = inspectable.nodeById(nodeId);
      const title = node?.title() ?? nodeId;
      const metadata = node?.currentDescribe()?.metadata ?? {};
      const icon = getStepIcon(metadata.icon, node?.currentPorts());

      // Get the current state from runner.state (if available)
      const nodeState = runner.state?.get(nodeId);
      const status = nodeState
        ? mapLifecycleToRunStatus(nodeState.state)
        : "inactive";

      const entry = RunController.createConsoleEntry(title, status, {
        icon,
        tags: metadata.tags,
      });
      newEntries.set(nodeId, entry);

      // If metadata wasn't ready (no tags), async fetch full describe
      // Note: These async updates use setConsoleEntry which triggers reactivity
      if (!metadata.tags && node) {
        node.describe().then((result) => {
          const { icon: asyncIcon, tags: asyncTags } = result.metadata || {};
          const resolvedIcon = getStepIcon(asyncIcon, node.currentPorts());
          const updatedEntry = RunController.createConsoleEntry(title, status, {
            icon: resolvedIcon,
            tags: asyncTags,
          });
          runController.setConsoleEntry(nodeId, updatedEntry);
        });
      }
    }

    // Replace the console atomically with new entries
    // This triggers @field signal due to reference change (immutable pattern)
    runController.replaceConsole(newEntries);
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
