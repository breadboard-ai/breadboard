/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeDescriptor,
  GraphDescriptor,
  InputValues,
  OutputValues,
  NodeIdentifier,
  PortIdentifier,
  NodeValue,
  Outcome,
} from "@breadboard-ai/types";
import {
  ExecutionPlan,
  NodeLogic,
  PlanNodeInfo,
  NodeState,
  ExecutionNodeInfo,
} from "./types.js";

export { Executor };

/**
 * The cache of results managed by the Executor. The cache stores the results
 * of all nodes that reach "succeeded" state.
 */
type ResultCache = Map<NodeIdentifier, Map<PortIdentifier, NodeValue>>;

/**
 * Instantiated for each node, holds current state of node in the execution
 * process as well as plan node information (upstream/downstream dependencies)
 */
class NodeStateController {
  state: NodeState = "waiting";

  constructor(
    public readonly node: NodeDescriptor,
    public readonly info: PlanNodeInfo
  ) {}

  /**
   * Lifecycle method, called at the beginning of executing each stage and
   * prior to invoking the NodeLogic.
   * Performs dependency check (met if the upstream node states are marked as
   * "succeeded" or "cached") and updates this node's state:
   * - If cached output exist for this node, transitions to "cached" state
   * - Otherwise, check for upstream dependencies and if ready, transition to
   * "ready" state.
   * - If a dependency is marked as "skipped" or "failed", transition to
   * "skipped" state.
   */
  beforeInvoking(cache: ResultCache): void {
    throw new Error("Not yet implemented");
  }
  /**
   * Lifecycle method, called after the NodeLogic has been invoked.
   * If invocation failed, transition to "failed" state. Otherwise, transition
   * to "succeeded" state
   */
  afterInvoking(failed: boolean): void {
    throw new Error("Not yet implemented");
  }
}

/**
 * Consumes the ExecutionPlan and manages the graph's execution,
 * incorporating a caching layer to facilitate interactive workflows.
 */
class Executor {
  constructor(public readonly plan: ExecutionPlan) {}

  /**
   * Triggers the execution of a single node.
   * The command will fail if the node's dependencies are not met (i.e., their outputs are not in the cache or successfully run in the current session).
   */
  async runNode(id: NodeIdentifier): Promise<Outcome<OutputValues>> {
    throw new Error("Not yet implemented");
  }

  /**
   * Clears the results cache for the specified node.
   */
  clearResultsForNode(id: NodeIdentifier): void {
    throw new Error("Not yet implemented");
  }

  /**
   * Clears the results cache
   */
  clearResults(): void {
    throw new Error("Not yet implemented");
  }

  /**
   * Initiates a graph run using the data currently in the results cache.
   * Only nodes whose state is not Succeeded or Cached will be executed.
   * The system will automatically find all Ready nodes based on the cache
   * and begin execution from there.
   */
  async run(): Promise<Outcome<void>> {
    throw new Error("Not yet implemented");
  }

  /**
   * Returns the current state of nodes.
   */
  status(): ExecutionNodeInfo[] {
    throw new Error("Not yet implemented");
  }
}
