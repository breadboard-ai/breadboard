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
  createRunner(
    graph: GraphDescriptor & {
      // GraphDescriptors usually only have a url if they are loaded by a
      // loader, but in this context we are often directly importing some BGL
      // from the source tree. Require that callers are sure there is a URL.
      url: string;
    }
  ): Promise<HarnessRunner>;
}
