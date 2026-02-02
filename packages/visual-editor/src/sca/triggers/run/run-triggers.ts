/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RunError } from "@breadboard-ai/types";
import { STATUS } from "../../../ui/types/types.js";
import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * @fileoverview
 *
 * Run Triggers - reacts to runner events to update controller state.
 *
 * The trigger listens to HarnessRunner lifecycle events and updates
 * the RunController status accordingly.
 */

/**
 * Registers listeners on the current runner to update controller status.
 *
 * Call this after setting a runner on the controller via RunActions.prepare().
 * The trigger will listen to start/pause/resume/end/error events and update
 * controller.run.main.status.
 *
 * Note: This must be called after the runner is set on the controller.
 */
export function registerRunStatusListener(): void {
  const { controller } = bind;
  const { runner } = controller.run.main;

  if (!runner) {
    console.warn("registerRunStatusListener called without an active runner");
    return;
  }

  runner.addEventListener("start", () => {
    controller.run.main.setStatus(STATUS.RUNNING);
  });

  runner.addEventListener("resume", () => {
    controller.run.main.setStatus(STATUS.RUNNING);
  });

  runner.addEventListener("pause", () => {
    controller.run.main.setStatus(STATUS.PAUSED);
  });

  runner.addEventListener("end", () => {
    controller.run.main.setStatus(STATUS.STOPPED);
  });

  runner.addEventListener("error", () => {
    controller.run.main.setStatus(STATUS.STOPPED);
  });
}

/**
 * Reacts to graph topology changes by updating the run's estimated entry count.
 *
 * ## Why This Trigger Is Necessary
 *
 * When the graph topology changes during a run (e.g., user adds/removes nodes
 * while the board is running), progress calculations need updating:
 *
 * 1. **Progress calculations** become inaccurate (node count changed)
 * 2. **Step list** may need to adjust for new nodes
 *
 * This trigger watches GraphController.version (which increments on any graph
 * change) and updates the RunController's estimated entry count.
 *
 * ## Architectural Note
 *
 * The RunController does NOT store a copy of the graph. When Triggers need
 * node metadata (e.g., to populate console entries), they access it via
 * Services.graphStore, which has the canonical graph data. This keeps
 * Controllers decoupled from Services.
 */
export function registerGraphSyncTrigger(): void {
  bind.register("Graph Synchronization Trigger", () => {
    const { controller } = bind;
    const graphController = controller.editor.graph;
    const runController = controller.run.main;

    // Reading `version` subscribes to graph changes
    void graphController.version;

    // If there's an active run, update the estimated entry count
    // based on the new graph topology
    if (runController.hasRunner) {
      const nodeCount = graphController.editor?.raw()?.nodes?.length ?? 0;
      runController.setEstimatedEntryCount(nodeCount);
    }
  });
}

/**
 * Registers listeners for runner output events (input, error, end).
 *
 * This trigger wires HarnessRunner output-related events to the RunController's
 * output state methods. It handles:
 *
 * - `input` events → sets input on controller (run waiting for user input)
 * - `error` events → sets fatal error on controller
 * - `end` events → clears input and resets output state
 *
 * ## Node Metadata Lookups
 *
 * For console entry creation, the trigger can access node metadata via
 * `services.graphStore.inspect()`. This keeps the Controller decoupled
 * from Services while allowing rich metadata in console entries.
 *
 * Call this after setting a runner on the controller.
 */
export function registerOutputListener(): void {
  const { controller, services } = bind;
  const runController = controller.run.main;
  const { runner } = runController;

  if (!runner) {
    console.warn("registerOutputListener called without an active runner");
    return;
  }

  // Handle input events - set input on controller
  runner.addEventListener("input", (event) => {
    const { inputArguments } = event.data;
    const schema = inputArguments?.schema || {};
    const id = event.data.node?.id ?? "";

    runController.setInput({ id, schema });
  });

  // Handle error events - set fatal error on controller
  runner.addEventListener("error", (event) => {
    const { error } = event.data;
    let runError: RunError;

    if (typeof error === "string") {
      runError = { message: error };
    } else if (error && typeof error === "object") {
      runError = {
        message: (error as { message?: string }).message ?? "Unknown error",
        details: (error as { details?: string }).details,
      };
    } else {
      runError = { message: "Unknown error" };
    }

    runController.setError(runError);
    runController.clearInput();
  });

  // Handle end events - clean up state
  runner.addEventListener("end", () => {
    runController.clearInput();
  });

  // Handle graphstart - reset output for fresh run
  runner.addEventListener("graphstart", (event) => {
    // Only reset for top-level graph (not subgraphs)
    if (event.data.path.length === 0) {
      runController.resetOutput();

      // Set initial estimated entry count from node count
      const graph = controller.editor.graph.editor?.raw();
      if (graph) {
        runController.setEstimatedEntryCount(graph.nodes?.length ?? 0);
      }
    }
  });

  // Handle nodestart - create console entry with metadata
  runner.addEventListener("nodestart", (event) => {
    // Only handle top-level nodes for now
    if (event.data.path.length > 1) return;

    const nodeId = event.data.node.id;
    const graph = controller.editor.graph.editor?.raw();

    if (!graph) return;

    // Look up node metadata from the graph
    const graphDescriptor = services.graphStore.getByDescriptor(graph);
    if (!graphDescriptor?.success) return;

    const inspectable = services.graphStore.inspect(graphDescriptor.result, "");
    const node = inspectable?.nodeById(nodeId);
    const title = node?.title() ?? nodeId;
    const metadata = node?.currentDescribe()?.metadata ?? {};

    // Create a simple console entry (placeholder - will enhance later)
    const entry = {
      id: nodeId,
      title,
      icon: metadata.icon,
      tags: metadata.tags,
      status: "working" as const,
    };

    runController.setConsoleEntry(nodeId, entry as unknown as import("@breadboard-ai/types").ConsoleEntry);
  });
}
