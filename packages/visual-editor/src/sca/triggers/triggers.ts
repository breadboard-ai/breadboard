/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppActions } from "../actions/actions.js";
import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Agent from "./agent/agent-triggers.js";
import * as Board from "./board/board-triggers.js";
import * as Node from "./node/node-triggers.js";
import * as Router from "./router/router-triggers.js";
import * as Run from "./run/run-triggers.js";
import * as ScreenSize from "./screen-size/screen-size-triggers.js";
import * as Shell from "./shell/shell-triggers.js";
import * as Step from "./editor/step-triggers.js";

export interface AppTriggers {
  agent: typeof Agent;
  board: typeof Board;
  node: typeof Node;
  router: typeof Router;
  run: typeof Run;
  screenSize: typeof ScreenSize;
  shell: typeof Shell;
  step: typeof Step;
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
    Agent.bind({ controller, services, actions });
    Board.bind({ controller, services, actions });
    Node.bind({ controller, services, actions });
    Router.bind({ controller, services, actions });
    Run.bind({ controller, services, actions });
    ScreenSize.bind({ controller, services, actions });
    Shell.bind({ controller, services, actions });
    Step.bind({ controller, services, actions });
    register();

    instance = {
      agent: Agent,
      board: Board,
      node: Node,
      router: Router,
      run: Run,
      screenSize: ScreenSize,
      shell: Shell,
      step: Step,
    } satisfies AppTriggers;
  }
  return instance;
}

export function register() {
  Agent.registerGraphInvalidateTrigger();
  Agent.registerGraphUrlChangeTrigger();
  Board.registerSaveTrigger();
  Board.registerNewerVersionTrigger();
  Board.registerSaveStatusListener();
  Node.registerAutonameTrigger();
  Router.registerPopstateTrigger();
  Router.registerInitTrigger();
  Run.registerGraphSyncTrigger();
  ScreenSize.registerMediaQueryTrigger();
  Shell.registerPageTitleTrigger();
  Step.registerStepAutoSaveTrigger();
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

// Re-export individual modules for direct access in tests
export { Agent, Board, Node, Router, Run, ScreenSize, Shell, Step };

