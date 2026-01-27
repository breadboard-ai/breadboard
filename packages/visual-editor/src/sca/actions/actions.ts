/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Board from "./board/board-actions.js";
import * as Graph from "./graph/graph-actions.js";

export interface AppActions {
  board: typeof Board;
  graph: typeof Graph;
}

let instance: AppActions | null = null;
export function actions(controller: AppController, services: AppServices) {
  if (!instance) {
    Board.bind({ controller, services });
    Graph.bind({ controller, services });

    instance = {
      board: Board,
      graph: Graph,
    } satisfies AppActions;
  }
  return instance;
}
