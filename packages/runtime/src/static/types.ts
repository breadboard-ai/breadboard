/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriptor,
  NodeIdentifier,
  Outcome,
  OutputValues,
  PortIdentifier,
} from "@breadboard-ai/types";

/**
 * The result of generating a staged execution plan from a condensed
 * GraphDescriptor (no cycles) using topological sort.
 */
export type ExecutionPlan = {
  /**
   * An array of stages in the execution plan.
   */
  stages: PlanStage[];
};

/**
 * Represents a static stage in the execution plan: a group of nodes that can
 * be executed in parallel. It is called "static", because the nodes to run
 * in this stage are statically determined.
 */
export type StaticStage = {
  type: "static";
  /**
   * A group of nodes that can be executed in parallel.
   */
  nodes: PlanNodeInfo[];
};

export type Dependency = { from: PlanNodeInfo; in: PortIdentifier };
export type Dependent = { to: PlanNodeInfo; out: PortIdentifier };

/**
 * Represents detailed information that was computed during creating of a
 * stage.
 */
export type PlanNodeInfo = {
  /**
   * The id of the node
   */
  id: NodeIdentifier;
  /**
   * The nodes and ports in next stage(s) that depend on this node.
   */
  downstream: Dependent[];
  /**
   * The nodes and ports in the previous stage(s) that are dependencies for
   * this node.
   */
  upstream: Dependency[];
};

/**
 * Represents a "virtual machine" stage in the execution plan: a node in the
 * graph that points into a strongly connected component (SCC) within the
 * graph. The SCC is represented by a subgraph.
 * Running this stage requires a virtual machine to run, since the SCC contains
 * cycles and its execution is non-deterministic.
 */
export type VmStage = {
  type: "vm";
  /**
   * A node within the graph that refers to a subgraph (the type of this node
   * will be "#<id of subgraph>"") that contains an SCC.
   */
  node: PlanNodeInfo;
};

export type PlanStage = StaticStage | VmStage;

/**
 * Encapsulates the logic of the node, consuming inputs and producing outputs.
 * The distinction between “static” and “vm” execution is handled by this type.
 * The inputs are all port values of the dependencies.
 */
export type NodeLogic = {
  invoke(
    node: NodeDescriptor,
    inputs: InputValues
  ): Promise<Outcome<OutputValues>>;
};

/**
 * Possible states of a node while in Executor.
 */
export type NodeState =
  // Node is awaiting dependencies
  | "waiting"
  // Node dependencies met, queued for execution
  | "ready"
  // Node logic is being invoked
  | "running"
  // Node logic invocation completed successfully, outputs written to the cache.
  | "succeeded"
  // The node's valid output already exists in the cache; execution is skipped.
  | "cached"
  // Node invocation is bypassed (usually due to conditional routing)
  | "skipped"
  // Node logic produced an error
  | "failed";

export type ExecutionNodeInfo = {
  id: NodeIdentifier;
  state: NodeState;
};
