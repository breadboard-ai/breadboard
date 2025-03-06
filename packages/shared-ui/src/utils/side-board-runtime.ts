/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, LLMContent } from "@breadboard-ai/types";
import {
  Outcome,
  TypedEventTarget,
  TypedEventTargetType,
} from "@google-labs/breadboard";
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
export type SideBoardRuntime =
  TypedEventTargetType<SideBoardRuntimeEventMap> & {
    createRunner(graph: GraphDescriptor): Promise<HarnessRunner>;
    runTask(task: SideBoardRuntimeTaskSpec): Promise<Outcome<LLMContent[]>>;
  };

export type SideBoardRuntimeEmptyEvent = Event;
export type SideBoardRuntimeBusyEvent = Event;

export type SideBoardRuntimeEventMap = {
  empty: SideBoardRuntimeEmptyEvent;
  running: SideBoardRuntimeBusyEvent;
};

export type SideBoardRuntimeEventTarget =
  TypedEventTarget<SideBoardRuntimeEventMap>;

export type SideBoardRuntimeTaskSpec = {
  graph: GraphDescriptor;
  context: LLMContent[];
};
