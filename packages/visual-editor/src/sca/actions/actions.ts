/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Board from "./board/board-actions.js";
import * as Graph from "./graph/graph-actions.js";
import * as Run from "./run/run-actions.js";

export interface AppActions {
  board: typeof Board;
  graph: typeof Graph;
  run: typeof Run;
}

let instance: AppActions | null = null;
export function actions(controller: AppController, services: AppServices) {
  if (!instance) {
    Board.bind({ controller, services });
    Graph.bind({ controller, services });
    Run.bind({ controller, services });

    instance = {
      board: Board,
      graph: Graph,
      run: Run,
    } satisfies AppActions;
  }
  return instance;
}
