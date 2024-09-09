/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "./board.js";
import { Run } from "./run.js";
import { VERuntimeConfig } from "./types.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

export function create(config: VERuntimeConfig): { board: Board; run: Run } {
  return {
    board: new Board(config.providers),
    run: new Run(config.dataStore, config.runStore),
  } as const;
}

export type RuntimeInstance = ReturnType<typeof create>;
