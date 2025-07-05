/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier, OutputValues } from "@breadboard-ai/types";

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
  nodes: NodeIdentifier[];
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
  node: NodeIdentifier;
};

export type PlanStage = StaticStage | VmStage;

export type NodeState =
  // The node is currently waiting for dependencies to complete (default)
  | "waiting"
  // All dependencies have been satisfied, ready to run
  | "ready"
  // The node is currently running
  | "running"
  // The node ran successfully and the outputs have been passed on
  | "succeeded"
  // The node was skipped because the dependencies produced one or more
  // empty outputs
  | "skipped"
  // Node failed to run
  | "failed";

export type NodeController = {
  state: NodeState;
  run(): Promise<OutputValues>;
};
