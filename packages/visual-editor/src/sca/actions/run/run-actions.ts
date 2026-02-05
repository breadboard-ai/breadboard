/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
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
import { onDblClick, onGraphVersionForSync } from "./triggers.js";

export const bind = makeAction();

// =============================================================================
// Coordinated Actions
// =============================================================================

export const testAction = asAction(
  "Run.test",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onDblClick(),
  },
  async (): Promise<void> => {
    return new Promise((r) => setTimeout(r, 3_000));
  }
);

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
export function prepare(config: PrepareRunConfig): void {
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
  const fileSystem = services.graphStore.fileSystem.createRunFileSystem({
    graphUrl: url,
    env: envFromGraphDescriptor(services.graphStore.fileSystem.env(), graph),
    assets: assetsFromGraphDescriptor(graph),
  });

  // Build the full RunConfig
  const runConfig: RunConfig = {
    url,
    runner: graph,
    diagnostics: true,
    kits: services.kits,
    loader: services.loader,
    graphStore: services.graphStore,
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
      LABEL,
      false
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

  // Register output listeners on the runner
  runner.addEventListener("input", (event) => {
    const { inputArguments } = event.data;
    const schema = inputArguments?.schema || {};
    const id = event.data.node?.id ?? "";
    controller.run.main.setInput({ id, schema });
  });

  runner.addEventListener("error", (event) => {
    const error = event.data?.error;
    const message =
      typeof error === "string"
        ? error
        : (error as { message?: string })?.message ?? "Unknown error";
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
      const graphDescriptor = services.graphStore.getByDescriptor(graph);
      if (graphDescriptor?.success) {
        const inspectable = services.graphStore.inspect(graphDescriptor.result, "");
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
              const { icon: asyncIcon, tags: asyncTags } = result.metadata || {};
              const resolvedIcon = getStepIcon(asyncIcon, node.currentPorts());
              const updatedEntry = RunController.createConsoleEntry(title, "inactive", {
                icon: resolvedIcon,
                tags: asyncTags,
              });
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
    const graphDescriptor = services.graphStore.getByDescriptor(graph);
    if (!graphDescriptor?.success) return;

    const inspectable = services.graphStore.inspect(graphDescriptor.result, "");
    const node = inspectable?.nodeById(nodeId);
    const title = node?.title() ?? nodeId;
    const metadata = node?.currentDescribe()?.metadata ?? {};

    const entry = RunController.createConsoleEntry(title, "working", {
      icon: getStepIcon(metadata.icon, node?.currentPorts()),
      tags: metadata.tags,
    });
    controller.run.main.setConsoleEntry(nodeId, entry);
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
    }
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
  syncConsoleFromRunner();
}

/**
 * Maps a NodeLifecycleState to a NodeRunStatus for console entries.
 * Note: NodeRunStatus excludes "failed" - failed nodes map to "succeeded"
 * as they are complete, with error styling handled via separate error state.
 */
export function mapLifecycleToRunStatus(state: NodeLifecycleState): NodeRunStatus {
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
export function syncConsoleFromRunner(): void {
  const { controller, services } = bind;
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

  const graphDescriptor = services.graphStore.getByDescriptor(graph);
  if (!graphDescriptor?.success) {
    return;
  }

  const inspectable = services.graphStore.inspect(graphDescriptor.result, "");
  if (!inspectable) {
    return;
  }

  // Build console entries in a regular Map first
  const newEntries = new Map<string, import("@breadboard-ai/types").ConsoleEntry>();

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

// =============================================================================
// Triggered Actions
// =============================================================================

/**
 * Triggered wrapper for syncConsoleFromRunner.
 * Fires when graph version changes to sync run console state.
 *
 * **Triggers:**
 * - `onGraphVersionForSync`: Fires when graph version changes
 */
export const syncConsoleFromTrigger = asAction(
  "Run.syncConsoleFromTrigger",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphVersionForSync(bind),
  },
  async (): Promise<void> => {
    // Delegate to the existing sync function
    syncConsoleFromRunner();
  }
);

