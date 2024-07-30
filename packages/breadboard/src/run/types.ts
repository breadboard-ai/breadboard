/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputValues, TraversalResult } from "../types.js";

/**
 * Sequential number of the invocation of a node.
 * Useful for understanding the relative position of a
 * given invocation of node within the run.
 */
export type InvocationId = number;

/**
 * Information about a given invocation of a graph and
 * node within the graph.
 */
export type RunStackEntry = {
  /**
   * The URL of the graph being run;
   */
  url: string | undefined;
  /**
   * The invocation path of the node within the graph.
   */
  path: number[];
  /**
   * The state of the graph traversal at the time of the invocation.
   */
  state?: string;
};

/**
 * A stack of all invocations of graphs and nodes within the graphs.
 * The stack is ordered from the outermost graph to the innermost graph
 * that is currently being run.
 * Can be used to understand the current state of the run.
 */
export type RunState = RunStackEntry[];

/**
 * A representation of the current run state.
 * Given this representation RunStateManager can correctly
 * resume a run.
 */
export type CurrentRunState = {
  // TODO: Define.
};

export type ManagedRunStateLifecycle = {
  /**
   * Signifies the beginning of a new graph being run or invoked.
   * @param url -- url of the graph that is starting
   */
  dispatchGraphStart(url: string): void;
  dispatchNodeStart(
    result: TraversalResult,
    invocationPath: number[]
  ): Promise<void>;
  dispatchNodeEnd(): void;
  dispatchGraphEnd(): void;
  dispatchSkip(): void;
  state(): RunState;
  /**
   * Returns true when the run is complete. The run is complete when
   * the initial dispatchGraphStart was matched with the dispatchGraphEnd
   * of the same invocationPath.
   */
  complete(): boolean;
};

/**
 * The representation of Breadboard runtime.
 * TODO: Rename to ManagedRuntime.
 */
export type ManagedRunState = {
  /**
   * The entry point for signaling run lifecycle changes.
   */
  lifecycle(): ManagedRunStateLifecycle;
  reanimation(): ReanimationController;
};

export type ReanimationMode =
  /**
   * This run is just replaying existing results.
   */
  | "replay"
  /**
   * This run is resuming from a previously saved state.
   */
  | "resume"
  /**
   * This run is running normally.
   */
  | "none";

export type ReanimationController = {
  enter(): ReanimationFrameController;
};

export type ReanimationFrameController = {
  mode(): ReanimationMode;
  replay(): ReplayResults;
  resume(): ResumeResults;
};

export type ReplayResults = {
  result: TraversalResult;
  invocationId: InvocationId;
  path: number[];
};

export type ResumeResults = {
  result: TraversalResult;
  invocationPath: number[];
};

export type ReanimationFrame = {
  /**
   * The state to resume from.
   */
  result: TraversalResult;
  /**
   * Invocation path of the node.
   */
  invocationPath: number[];
  /**
   * The results of all completed `invokeGraph` calls.
   * This list will be empty for the typical invoke case,
   * but will contain values for nodes that call `invokeGraph`
   * more than once during their execution (like `map`
   * and `reduce`)
   *
   * The order is the same as the order of the `invokeGraph`
   * calls from the node.
   */
  replayOutputs: OutputValues[];
};
