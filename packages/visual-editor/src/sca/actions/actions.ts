/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Agent from "./agent/agent-actions.js";
import * as Asset from "./asset/asset-actions.js";
import * as Board from "./board/board-actions.js";
import * as Flowgen from "./flowgen/flowgen-actions.js";
import * as Graph from "./graph/graph-actions.js";
import * as Host from "./host/host-actions.js";
import * as Node from "./node/node-actions.js";
import * as Router from "./router/router-actions.js";
import * as Run from "./run/run-actions.js";
import * as ScreenSize from "./screen-size/screen-size-actions.js";
import * as Share from "./share/share-actions.js";
import * as Shell from "./shell/shell-actions.js";
import * as Sidebar from "./sidebar/sidebar-actions.js";
import * as Step from "./step/step-actions.js";
import * as Theme from "./theme/theme-actions.js";
import type { ActionWithTriggers } from "../coordination.js";
import { Utils } from "../utils.js";

export interface AppActions {
  agent: typeof Agent;
  asset: typeof Asset;
  board: typeof Board;
  flowgen: typeof Flowgen;
  graph: typeof Graph;
  host: typeof Host;
  node: typeof Node;
  router: typeof Router;
  run: typeof Run;
  screenSize: typeof ScreenSize;
  share: typeof Share;
  shell: typeof Shell;
  sidebar: typeof Sidebar;
  step: typeof Step;
  theme: typeof Theme;
}

let instance: AppActions | null = null;
let triggerDisposers: Array<() => void> = [];

export function actions(controller: AppController, services: AppServices) {
  if (!instance) {
    Agent.bind({ controller, services });
    Asset.bind({ controller, services });
    Board.bind({ controller, services });
    Flowgen.bind({ controller, services });
    Graph.bind({ controller, services });
    Host.bind({ controller, services });
    Node.bind({ controller, services });
    Router.bind({ controller, services });
    Run.bind({ controller, services });
    ScreenSize.bind({ controller, services });
    Share.bind({ controller, services });
    Shell.bind({ controller, services });
    Sidebar.bind({ controller, services });
    Step.bind({ controller, services });
    Theme.bind({ controller, services });
    instance = {
      agent: Agent,
      asset: Asset,
      board: Board,
      flowgen: Flowgen,
      graph: Graph,
      host: Host,
      node: Node,
      router: Router,
      run: Run,
      screenSize: ScreenSize,
      share: Share,
      shell: Shell,
      sidebar: Sidebar,
      step: Step,
      theme: Theme,
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
 * Default priority is 0.
 *
 * @returns Dispose function to deactivate all triggers
 */
const LABEL = "Actions";

export function activateTriggers(): () => void {
  // Collect all actions from all modules
  const allActions = [
    ...Object.values(Agent),
    ...Object.values(Asset),
    ...Object.values(Board),
    ...Object.values(Flowgen),
    ...Object.values(Graph),
    ...Object.values(Host),
    ...Object.values(Node),
    ...Object.values(Router),
    ...Object.values(Run),
    ...Object.values(ScreenSize),
    ...Object.values(Share),
    ...Object.values(Shell),
    ...Object.values(Sidebar),
    ...Object.values(Step),
    ...Object.values(Theme),
  ];

  // Filter to actions with triggers and extract metadata
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

  // Sort by priority (higher first)
  actionsWithTriggers.sort((a, b) => b.priority - a.priority);

  // Log activation order
  const activationOrder = actionsWithTriggers.map(
    (a) => `${a.name} (priority: ${a.priority}, type: ${a.triggerType})`
  );
  const logger = Utils.Logging.getLogger();
  logger.log(
    Utils.Logging.Formatter.group(
      "Trigger activation order",
      ` - ${activationOrder.join("\n - ")}`
    ),
    LABEL
  );

  // Activate in sorted order
  for (const { action } of actionsWithTriggers) {
    const dispose = action.activate();
    triggerDisposers.push(dispose);
  }

  // Return combined dispose function
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
  // Deactivate all triggers
  for (const dispose of triggerDisposers) {
    dispose();
  }
  triggerDisposers = [];
  instance = null;
}

// Re-export individual modules for direct access in tests
export {
  Agent,
  Asset,
  Board,
  Flowgen,
  Graph,
  Host,
  Node,
  Router,
  Run,
  ScreenSize,
  Share,
  Shell,
  Sidebar,
  Step,
  Theme,
};
