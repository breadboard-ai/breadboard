/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Board from "./board/board.js";
import * as Edit from "./edit/edit.js";

export interface AppActions {
  board: typeof Board;
  edit: typeof Edit;
}

let instance: AppActions | null = null;
export function actions() {
  if (!instance) {
    instance = {
      board: Board,
      edit: Edit,
    } satisfies AppActions;
  }
  return instance;
}
