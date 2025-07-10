/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge, InputValues, NodeDescriptor } from "@breadboard-ai/types";

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
 * Possible states of a node while in the Orchestrator.
 */
export type NodeOrchestratorState =
  // Node is awaiting dependencies
  | "waiting"
  // Node dependencies met, queued for invocation
  | "ready"
  // Node logic invocation completed successfully, outputs written to the cache.
  | "succeeded"
  // Node invocation is bypassed (usually due to conditional routing)
  | "skipped"
  // Node logic produced an error
  | "failed";

export type OrchestratorProgress =
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
  state: NodeOrchestratorState;
  node: NodeDescriptor;
};
