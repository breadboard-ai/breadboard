/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TraversalResult } from "../types.js";

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
   * The invocation id of the node within that graph.
   */
  node: InvocationId;
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
  dispatchNodeStart(result: TraversalResult): void;
  dispatchNodeEnd(): void;
  dispatchGraphEnd(): void;
  dispatchSkip(): void;
  state(): Promise<RunState>;
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
};
