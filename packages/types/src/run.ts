/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  NodeConfiguration,
  NodeIdentifier,
  OutputValues,
} from "./graph-descriptor.js";
import { InspectableRunSequenceEntry } from "./inspect.js";
import { TraversalResult } from "./traversal.js";

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
  /**
   * Outputs of the node if it has been run.
   */
  outputs?: OutputValues;
};

/**
 * A stack of all invocations of graphs and nodes within the graphs.
 * The stack is ordered from the outermost graph to the innermost graph
 * that is currently being run.
 * Can be used to understand the current state of the run.
 */
export type RunState = RunStackEntry[];

export type LifecyclePathRegistryEntry<Data> = {
  children: LifecyclePathRegistryEntry<Data>[];
  // parent: LifecyclePathRegistryEntry | null;
  data: Data | null;
};

export type ManagedRunStateLifecycle = {
  /**
   * Signifies the beginning of a new graph being run or invoked.
   * @param url -- url of the graph that is starting
   */
  dispatchGraphStart(url: string, invocationPath: number[]): void;
  dispatchNodeStart(
    result: TraversalResult,
    invocationPath: number[]
  ): Promise<void>;
  dispatchNodeEnd(
    outputs: OutputValues | undefined,
    invocationPath: number[]
  ): void;
  dispatchGraphEnd(): void;
  dispatchSkip(): void;
  dispatchEdge(edge: Edge): void;
  supplyPartialOutputs(
    outputs: OutputValues,
    invocationPath: number[]
  ): Promise<void>;
  state(): RunState;
  reanimationState(): ReanimationState;
  pathFor(node: NodeIdentifier): number[] | undefined;
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

export type ReanimationStateCache = Record<string, RunStackEntry>;
export type ReanimationStateVisits = [NodeIdentifier, number[]][];

export type ReanimationState = {
  states?: ReanimationStateCache;
  visits?: ReanimationStateVisits;
  /**
   * A run that consists of the events that preceded the point at which
   * the reanimation state was captured.
   */
  history?: InspectableRunSequenceEntry[];
  /**
   * Node configuration that overrides what's in the current state
   */
  nodeConfig?: NodeConfiguration;
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
  enter(invocationPath: number[]): ReanimationFrameController;
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
