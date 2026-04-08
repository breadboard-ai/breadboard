/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Sync from "./sync/sync-actions.js";
import * as Chat from "./chat/chat-actions.js";
import * as Stage from "./stage/stage-actions.js";
import * as Tree from "./tree/tree-actions.js";

import type { AppActions, AppController, AppServices } from "../types.js";
import type { ActionWithTriggers } from "../coordination.js";

export { Sync, Chat, Stage, Tree };

let instance: AppActions | null = null;
let triggerDisposers: Array<() => void> = [];

export function actions(controller: AppController, services: AppServices) {
  if (!instance) {
    Sync.bind({ controller, services });
    Chat.bind({ controller, services });
    Stage.bind({ controller, services });
    Tree.bind({ controller, services });

    instance = {
      sync: Sync,
      chat: Chat,
      stage: Stage,
      tree: Tree,
    } satisfies AppActions;
  }
  return instance;
}

/**
 * Activates triggers for all actions that have them.
 *
 * Call this after actions() during bootstrap. Returns a dispose function
 * to deactivate all triggers (useful for cleanup in tests).
 *
 * Actions are activated in priority order (higher priority first).
 */
export function activateTriggers(): () => void {
  const allActions = [
    ...Object.values(Sync),
    ...Object.values(Chat),
    ...Object.values(Stage),
    ...Object.values(Tree),
  ];

  const actionsWithTriggers: Array<{
    action: ActionWithTriggers<(...args: never[]) => Promise<unknown>>;
    name: string;
    priority: number;
  }> = [];

  for (const action of allActions) {
    if (typeof action !== "function") continue;
    if (!("activate" in action)) continue;
    if (typeof action.activate !== "function") continue;

    const actionWithTriggers = action as unknown as ActionWithTriggers<
      (...args: never[]) => Promise<unknown>
    >;

    if (!actionWithTriggers.trigger) continue;

    actionsWithTriggers.push({
      action: actionWithTriggers,
      name: actionWithTriggers.actionName ?? "unknown",
      priority: actionWithTriggers.priority ?? 0,
    });
  }

  // Sort by priority (higher first).
  actionsWithTriggers.sort((a, b) => b.priority - a.priority);

  // Activate in sorted order.
  for (const { action } of actionsWithTriggers) {
    const dispose = action.activate();
    triggerDisposers.push(dispose);
  }

  // Run actions flagged with runOnActivate.
  for (const { action, name } of actionsWithTriggers) {
    if (!action.runOnActivate) continue;
    action().catch((err: Error) => {
      console.error(`Boot-time run of ${name} failed:`, err);
    });
  }

  return () => {
    for (const dispose of triggerDisposers) {
      dispose();
    }
    triggerDisposers = [];
  };
}

/**
 * Cleans up action state. **For testing only.**
 */
export function cleanActions(): void {
  for (const dispose of triggerDisposers) {
    dispose();
  }
  triggerDisposers = [];
  instance = null;
}
