/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import * as Board from "./board/board.js";
import * as Edit from "./edit/edit.js";

export interface AppActions {
  board: typeof Board;
  edit: typeof Edit;
}

let instance: AppActions | null = null;
export function actions(controller: AppController, services: AppServices) {
  if (!instance) {
    Board.bind({ controller, services });
    Edit.bind({ controller, services });

    instance = {
      board: Board,
      edit: Edit,
    } satisfies AppActions;
  }
  return instance;
}
