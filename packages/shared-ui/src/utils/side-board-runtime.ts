/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import type { HarnessRunner } from "@google-labs/breadboard/harness";
import { createContext } from "@lit/context";

export const sideBoardRuntime = createContext<SideBoardRuntime | undefined>(
  "bb-side-board-runtime"
);

/**
 * A way to run a board from anywhere in the UI at any time, without assuming
 * the given board is the "main" one the user is editing, but with the same
 * configuration (secrets, board server, etc.).
 */
export interface SideBoardRuntime {
  createRunner(graph: GraphDescriptor): Promise<HarnessRunner>;
}
