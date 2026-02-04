/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { syncConsoleFromRunner } from "../../actions/run/run-actions.js";
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
 * Reacts to graph topology changes by syncing the run state.
 *
 * When the graph topology changes during a run (e.g., the Planner replaces
 * the graph via replaceWithTheme), this trigger detects the change and
 * calls the syncConsoleFromRunner action to update RunController.console.
 *
 * This trigger watches GraphController.version (which increments on any graph
 * change) and delegates the actual work to the action.
 */
export function registerGraphSyncTrigger(): void {
  bind.register("Graph Synchronization Trigger", () => {
    const { controller } = bind;
    const graphController = controller.editor.graph;

    // Reading `version` subscribes to graph changes
    void graphController.version;

    // Sync console from runner on every graph change
    // The action handles checking if there's an active runner
    syncConsoleFromRunner();
  });
}
