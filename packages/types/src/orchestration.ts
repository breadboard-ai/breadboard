/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  InputValues,
  NodeDescriptor,
  NodeIdentifier,
  OutputValues,
} from "./graph-descriptor.js";

/**
 * The current state of the orchestrator.
 */
export type OrchestratorState = Map<NodeIdentifier, OrchestratorNodeState>;

export type OrchestratorNodeState = {
  node: NodeDescriptor;
  stage: number;
  state: NodeLifecycleState;
  inputs: InputValues | null;
  outputs: OutputValues | null;
};

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

export type OrchestratorCallbacks = {
  /**
   * Called when the state of the node is changed by the orchestrator.
   *
   * @param id -- id of the node whose state has changed
   * @param newState -- new state value
   */
  stateChangedbyOrchestrator?: (
    id: NodeIdentifier,
    newState: NodeLifecycleState
  ) => void;

  stateChanged?: (newState: NodeLifecycleState, info: PlanNodeInfo) => void;
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
 * Reflects the current status of the edge:
 * - "initilal" -- the edge is in its initial state: no
 *   values have been stored on or consumed from this edge.
 * - "stored" -- a value was stored on the edge, but not yet consumed by the
 *   receiving node.
 * - "consumed" -- the value that was stored on the edge was consumed by the
 *   receiving edge. Constant wires never reach this state.
 */
export type EdgeLifecycleState = "initial" | "stored" | "consumed";
