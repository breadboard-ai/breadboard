/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Board from "./board/board-actions.js";
import * as Flowgen from "./flowgen/flowgen-actions.js";
import * as Graph from "./graph/graph-actions.js";
import * as Run from "./run/run-actions.js";
import * as Share from "./share/share-actions.js";

export interface AppActions {
  board: typeof Board;
  flowgen: typeof Flowgen;
  graph: typeof Graph;
  run: typeof Run;
  share: typeof Share;
}

let instance: AppActions | null = null;
export function actions(controller: AppController, services: AppServices) {
  if (!instance) {
    Board.bind({ controller, services });
    Flowgen.bind({ controller, services });
    Graph.bind({ controller, services });
    Run.bind({ controller, services });
    Share.bind({ controller, services });

    instance = {
      board: Board,
      flowgen: Flowgen,
      graph: Graph,
      run: Run,
      share: Share,
    } satisfies AppActions;
  }
  return instance;
}
