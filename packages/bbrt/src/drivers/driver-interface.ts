/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TurnChunk } from "../state/turn-chunk.js";
import type { ReactiveTurnState } from "../state/turn.js";
import type { BBRTTool } from "../tools/tool-types.js";

/**
 * A _driver_ implements interactions with a language model for the primary
 * conversation.
 */
export interface BBRTDriver extends BBRTDriverInfo {
  send(opts: BBRTDriverSendOptions): AsyncIterable<TurnChunk>;
}

export interface BBRTDriverInfo {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
}

export interface BBRTDriverSendOptions {
  systemPrompt: string;
  tools: Map<string, BBRTTool> | undefined;
  turns: ReactiveTurnState[];
}
