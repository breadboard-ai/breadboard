/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../types.js";
import { type AppServices } from "../services/services.js";
import type { AppEnvironment } from "../environment/environment.js";
import * as Router from "./router/router-actions.js";
import type { ActionWithTriggers } from "../coordination.js";
import { AppActions } from "../types.js";

let instance: AppActions | null = null;
let triggerDisposers: Array<() => void> = [];

export function actions(
  controller: AppController,
  services: AppServices,
  env: AppEnvironment
) {
  if (!instance) {
    Router.bind({ controller, services, env });
    instance = {
      router: Router,
    } satisfies AppActions;
  }
  return instance;
}

export function activateTriggers(): () => void {
  const allActions = [...Object.values(Router)];

  const actionsWithTriggers: Array<{
    action: ActionWithTriggers<(...args: never[]) => Promise<unknown>>;
    name: string;
    priority: number;
    triggerType: string;
  }> = [];

  for (const action of allActions) {
    if (typeof action !== "function") continue;
    if (!("activate" in action)) continue;
    if (typeof action.activate !== "function") continue;

    const actionWithTriggers = action as unknown as ActionWithTriggers<
      (...args: never[]) => Promise<unknown>
    >;

    if (!actionWithTriggers.trigger) continue;

    const trigger = actionWithTriggers.trigger();
    actionsWithTriggers.push({
      action: actionWithTriggers,
      name: actionWithTriggers.actionName ?? "unknown",
      priority: actionWithTriggers.priority ?? 0,
      triggerType: trigger?.type ?? "unknown",
    });
  }

  actionsWithTriggers.sort((a, b) => b.priority - a.priority);

  for (const { action } of actionsWithTriggers) {
    const dispose = action.activate();
    triggerDisposers.push(dispose);
  }

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

export function cleanActions(): void {
  for (const dispose of triggerDisposers) {
    dispose();
  }
  triggerDisposers = [];
  instance = null;
}

export { Router };
