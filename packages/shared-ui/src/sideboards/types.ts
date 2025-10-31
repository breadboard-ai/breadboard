/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, Outcome } from "@breadboard-ai/types";

/**
 * A way to run a board from anywhere in the UI at any time, without assuming
 * the given board is the "main" one the user is editing, but with the same
 * configuration (secrets, board server, etc.).
 */
export type SideBoardRuntime = {
  autoname(
    context: LLMContent[],
    signal: AbortSignal
  ): Promise<Outcome<LLMContent[]>>;
};
