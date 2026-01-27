/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppActions } from "../actions/actions.js";
import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Board from "./board/board-triggers.js";

export interface AppTriggers {
  board: typeof Board;
}

type TriggerKey = keyof AppTriggers;
type TriggerValues = AppTriggers[TriggerKey];

let instance: AppTriggers | null = null;
export function triggers(
  controller: AppController,
  services: AppServices,
  actions: AppActions
) {
  if (!instance) {
    Board.bind({ controller, services, actions });
    register();

    instance = {
      board: Board,
    } satisfies AppTriggers;
  }
  return instance;
}

export function register() {
  Board.registerSaveTrigger();
}

export function clean() {
  if (!instance) return;

  const triggerSections = Object.values(instance) as TriggerValues[];
  for (const triggerSection of triggerSections) {
    triggerSection.bind.clean();
  }
}

export function list() {
  if (!instance) return;

  const triggerLists: Partial<Record<TriggerKey, string[]>> = {};
  const triggerSections = Object.entries(instance) as [
    TriggerKey,
    TriggerValues,
  ][];
  for (const [sectionName, triggerSection] of triggerSections) {
    triggerLists[sectionName] = triggerSection.bind.list();
  }

  return triggerLists;
}

export function destroy() {
  clean();

  instance = null;
}
