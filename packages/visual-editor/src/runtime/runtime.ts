/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLoader } from "@google-labs/breadboard";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { VERuntimeConfig } from "./types.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

export function create(config: VERuntimeConfig): {
  board: Board;
  run: Run;
  edit: Edit;
} {
  const loader = createLoader(config.providers);
  return {
    board: new Board(config.providers, loader),
    edit: new Edit(config.providers, loader),
    run: new Run(config.dataStore, config.runStore),
  } as const;
}

export type RuntimeInstance = ReturnType<typeof create>;
