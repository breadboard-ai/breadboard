/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  InputValues,
  NodeDescriptor,
  NodeIdentifier,
  Outcome,
} from "@breadboard-ai/types";

/**
 * The result of generating a staged plan from a condensed
 * GraphDescriptor (no cycles) using topological sort.
 */
export type OrchestrationPlan = {
  /**
   * An array of stages in the plan.
   * Each stage is a group of nodes that can be invoked in parallel.
   */
  stages: PlanNodeInfo[][];
};

/**
 * Represents detailed information that was computed during creating of a
 * stage.
 */
export type PlanNodeInfo = {
  /**
   * The id of the node
   */
  node: NodeDescriptor;
  /**
   * The nodes and ports in next stage(s) that depend on this node.
   */
  downstream: Edge[];
  /**
   * The nodes and ports in the previous stage(s) that are dependencies for
   * this node.
   */
  upstream: Edge[];
};

/**
 * The full node lifecycle. Here's the progression:
 *
 * - "inactive" -- all nodes begin with this state and stay in this state until
 *   their dependencies have been met.
 *
 * - "ready" -- changes from "inactive" when node dependencies have been met,
 *   signaling that a node can be invoked
 *
 * - "working" -- changes from "ready" when the node is invoked.
 *
 * - "waiting" -- node may change from "working" to "waiting" when
 *   the additional input is requested by the node during its invocation.
 *   For example, the node might request user feedback on a draft of a
 *   generated content. Once input is provided, the state changes back to
 *   "working". The change from "working" to "waiting" may happen many times
 *   during node invocation.
 *
 * - "succeeded" - changes from "working" to signal that node invocation was
 *   successful
 *
 * - "failed" -- changes from "working" to signal that node invocation failed.
 *
 * - "skipped" -- changes from "inactive" to indicate that this
 *   node's dependencies can't be met. For example, this may happen when
 *   the upstream node failed, or did not provide the necessary outputs.
 *
 * - "interrupted" -- changes from "waiting" to signal that the node invocation
 *   was interrupted without providing additional input. Or changes from
 *   "working" to signal that the node invocation was interrupted without
 *   awaiting its completion.
 *
 *  https://github.com/breadboard-ai/breadboard/wiki/Next%E2%80%90Gen-Runtime
 */
export type NodeLifecycleState =
  // Node dependencies have not been met
  | "inactive"
  // Node dependencies met, queued for invocation
  | "ready"
  // Node logic invocation completed successfully, outputs written to the cache.
  | "succeeded"
  // Node invocation is bypassed (usually due to conditional routing)
  | "skipped"
  // Node logic produced an error
  | "failed"
  /**
   * The node is actively doing work. This state and the "waiting" state can
   * interleave, creating a multi-turn interaction that's all part of the
   * node execution
   */
  | "working"
  /**
   * The node is awaiting additional input
   */
  | "waiting"
  /**
   * The node invocation was interrupted
   */
  | "interrupted";

export type OrchestratorProgress =
  /**
   * The orchestrator hasn't begun yet.
   */
  | "initial"
  /**
   * The orchestrator is at a stage, and there are still tasks to be completed.
   */
  | "working"
  /**
   * The orchestrator finished going through all stages
   */
  | "finished"
  /**
   * The orchestrator just advanced to the next stage
   */
  | "advanced";

/**
 * A task, produced by the orchestrator.
 */
export type Task = {
  node: NodeDescriptor;
  inputs: InputValues;
};

export type OrchestrationNodeInfo = {
  state: NodeLifecycleState;
  node: NodeDescriptor;
};

/**
 * Very WIP, sketching out reactive Model + Controller
 * that replaces the current HarnessRunner
 */
export type OrchestrationController = {
  /**
   * Run the graph from start to finish or the next breakpoint.
   * Always restarts, resetting current state.
   * Promise resolves when the run completes.
   */
  run(): Promise<Outcome<void>>;
  /**
   * Run all incomplete stages to finish or the next breakpoint.
   * Promise resolves when the run completes.
   */
  continue(): Promise<Outcome<void>>;
  /**
   * Invoke the next "ready" node in the orchestration.
   * Promise resolves when the node invocation completes.
   * If the node reports failure, this is not an error that affects outcome.
   */
  stepThroughNode(): Promise<Outcome<void>>;
  /**
   * Step through the next incomplete stage in the orchestration.
   * Promise resolves when the stage completes.
   */
  stepThroughStage(): Promise<Outcome<void>>;
  /**
   * Provides a way to manage breakpoints.
   */
  breakpoints: BreakpointsController;
};

export type BreakpointsController = {
  /**
   * All current breakpoints.
   */
  readonly breakpoints: ReadonlyMap<NodeIdentifier, Breakpoint>;
  /**
   * Creates a breakpoint. Can be called multiple times on the same node.
   * @param node - the node at which to set the breakpoint
   */
  create(node: NodeIdentifier): void;
  /**
   * Removes a breakpoint. Can be called multiple times on the same node.
   * @param node - the node at which to remove the breakpoint
   */
  delete(node: NodeIdentifier): void;
  /**
   * Clears all breakpoints.
   */
  clear(): void;
};

export type Breakpoint = {
  /**
   * The node at which the breakpoint is set.
   */
  readonly id: NodeIdentifier;
  /**
   * Disables the breakpoint.
   */
  disable(): void;
  /**
   * Enables the breakpoint.
   */
  enable(): void;
};
