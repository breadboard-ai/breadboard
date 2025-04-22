/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  GraphDescriptor,
  NodeDescriberResult,
  Outcome,
  TypedEventTarget,
  TypedEventTargetType,
} from "@google-labs/breadboard";
import { HarnessRunner } from "@google-labs/breadboard/harness";

/**
 * A way to run a board from anywhere in the UI at any time, without assuming
 * the given board is the "main" one the user is editing, but with the same
 * configuration (secrets, board server, etc.).
 */
export type SideBoardRuntime =
  TypedEventTargetType<SideBoardRuntimeEventMap> & {
    createRunner(
      graph: GraphDescriptor | string,
      graphURLForProxy?: string
    ): Promise<HarnessRunner>;
    describe(url: string): Promise<Outcome<NodeDescriberResult>>;
    runTask(task: SideBoardRuntimeTaskSpec): Promise<Outcome<LLMContent[]>>;
    discardTasks(): void;
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
  /**
   * URL of the graph on behalf of which we run the task.
   */
  url?: string;
  graph: GraphDescriptor | string;
  context: LLMContent[];
  signal?: AbortSignal;
};
