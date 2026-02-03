/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  HarnessRunner,
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
import { Utils } from "../../utils.js";
import { RunController } from "../../controller/subcontrollers/run/run-controller.js";

export const bind = makeAction();

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
    const { inputArguments, path } = event.data;
    const schema = inputArguments?.schema || {};
    const inputNodeId = event.data.node?.id ?? "";
    controller.run.main.setInput({ id: inputNodeId, schema });

    // Find the parent console entry using the path
    // For nested nodes, this maps to the top-level parent's console entry
    const parentId = controller.run.main.getParentIdForPath(path);
    if (!parentId) {
      console.warn(`No parent console entry found for input event at path ${path}`);
      return;
    }

    const entry = controller.run.main.console.get(parentId);
    if (!entry) {
      console.warn(`Console entry not found for parent id "${parentId}"`);
      return;
    }

    // Add a work item with awaitingUserInput: true
    // This allows console-view to render the input under the step
    const workItem = {
      title: "Waiting for input",
      icon: "input",
      start: Date.now(),
      end: null,
      elapsed: 0,
      awaitingUserInput: true,
      openByDefault: true,
      schema,
      product: new Map(),
    };
    const newWork = new Map(entry.work);
    newWork.set(`input-${inputNodeId}`, workItem);
    controller.run.main.setConsoleEntry(parentId, {
      ...entry,
      work: newWork,
      open: true,
    });
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
    const path = event.data.path;

    // Register path-to-id mapping for finding parent console entries later
    controller.run.main.setPathId(path, nodeId);

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
  // Use runner.plan.stages for execution-ordered iteration
  const nodeIds: string[] = [];
  for (const stage of runner.plan?.stages ?? []) {
    for (const planNode of stage) {
      nodeIds.push(planNode.node.id);
    }
  }

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

