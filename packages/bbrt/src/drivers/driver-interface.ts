/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BBRTChunk } from "../llm/chunk.js";
import type { BBRTTurn } from "../llm/conversation.js";
import type { BBRTTool } from "../tools/tool.js";
import type { Result } from "../util/result.js";

/**
 * A _driver_ implements interactions with a language model for the primary
 * conversation.
 */
export interface BBRTDriver {
  readonly name: string;
  readonly icon: string;

  executeTurn(
    turns: BBRTTurn[],
    tools: BBRTTool[]
  ): Promise<Result<AsyncIterableIterator<BBRTChunk>>>;
}
