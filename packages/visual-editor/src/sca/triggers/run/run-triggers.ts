/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * @fileoverview
 *
 * Run Triggers - reacts to run-related controller state changes.
 *
 * Note: Runner lifecycle events (start, pause, end, input, error) are handled
 * directly in run-actions.ts where the runner is created. This follows the
 * Action-Encapsulated pattern for short-lived runner instances.
 */

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
