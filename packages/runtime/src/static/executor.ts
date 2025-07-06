/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  NodeIdentifier,
  NodeValue,
  Outcome,
  OutputValues,
  PortIdentifier,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import {
  ExecutionNodeInfo,
  ExecutionPlan,
  NodeLogic,
  NodeState,
  PlanNodeInfo,
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
    // Check if we already have cached results for this node
    if (cache.has(this.info.id)) {
      this.state = "cached";
      return;
    }

    // If no upstream dependencies, node is ready to execute
    if (this.info.upstream.length === 0) {
      this.state = "ready";
      return;
    }

    // Check if all upstream dependencies are satisfied
    for (const dependency of this.info.upstream) {
      const upstreamNode = dependency.from;
      const upstreamCache = cache.get(upstreamNode.id);

      // Find the corresponding output port from the upstream node
      const outputPort = upstreamNode.downstream.find(
        (dep) => dep.to.id === this.info.id
      )?.out;

      // If we can't find the output port or no cache exists, we can't proceed
      if (!outputPort || !upstreamCache || !upstreamCache.has(outputPort)) {
        this.state = "waiting";
        return;
      }
    }

    // All dependencies are met, node is ready to execute
    this.state = "ready";
  }
  /**
   * Lifecycle method, called after the NodeLogic has been invoked.
   * If invocation failed, transition to "failed" state. Otherwise, transition
   * to "succeeded" state
   */
  afterInvoking(success: boolean): void {
    this.state = success ? "succeeded" : "failed";
  }
}

/**
 * Consumes the ExecutionPlan and manages the graph's execution,
 * incorporating a caching layer to facilitate interactive workflows.
 */
class Executor {
  public readonly cache: ResultCache = new Map();
  public readonly controllers: Map<NodeIdentifier, NodeStateController> =
    new Map();

  constructor(
    public readonly plan: ExecutionPlan,
    public readonly graph: GraphDescriptor,
    public readonly nodeLogic: NodeLogic
  ) {
    // Initialize controllers
    for (const stage of this.plan.stages) {
      if (stage.type === "static") {
        for (const nodeInfo of stage.nodes) {
          const nodeDescriptor = this.graph.nodes.find(
            (n) => n.id === nodeInfo.id
          );
          if (nodeDescriptor) {
            this.controllers.set(
              nodeInfo.id,
              new NodeStateController(nodeDescriptor, nodeInfo)
            );
          }
        }
      } else if (stage.type === "vm") {
        const nodeDescriptor = this.graph.nodes.find(
          (n) => n.id === stage.node.id
        );
        if (nodeDescriptor) {
          this.controllers.set(
            stage.node.id,
            new NodeStateController(nodeDescriptor, stage.node)
          );
        }
      }
    }
  }

  #gatherInputsForNode(nodeId: NodeIdentifier): InputValues {
    const controller = this.controllers.get(nodeId);
    if (!controller) {
      return {};
    }

    const inputs: InputValues = {};
    for (const dependency of controller.info.upstream) {
      const upstreamCache = this.cache.get(dependency.from.id);

      // Find the corresponding output port from the upstream node
      const outputPort = dependency.from.downstream.find(
        (dep) => dep.to.id === nodeId
      )?.out;

      if (outputPort && upstreamCache && upstreamCache.has(outputPort)) {
        inputs[dependency.in] = upstreamCache.get(outputPort);
      }
    }
    return inputs;
  }

  #storeOutputsForNode(nodeId: NodeIdentifier, outputs: OutputValues): void {
    if (!this.cache.has(nodeId)) {
      this.cache.set(nodeId, new Map());
    }
    const nodeCache = this.cache.get(nodeId)!;
    for (const [port, value] of Object.entries(outputs)) {
      nodeCache.set(port, value);
    }
  }

  /**
   * Triggers the execution of a single node.
   * The command will fail if the node's dependencies are not met (i.e., their outputs are not in the cache or successfully run in the current session).
   */
  async runNode(id: NodeIdentifier): Promise<Outcome<OutputValues>> {
    const controller = this.controllers.get(id);
    if (!controller) {
      return err(`Node with id '${id}' not found in execution plan`);
    }

    // Check if node is ready to execute
    controller.beforeInvoking(this.cache);

    if (controller.state === "cached") {
      const cachedResults = this.cache.get(id);
      if (cachedResults) {
        const outputs: OutputValues = {};
        for (const [port, value] of cachedResults.entries()) {
          outputs[port] = value;
        }
        return outputs;
      }
    }

    if (controller.state !== "ready") {
      return err(
        `Node '${id}' is not ready for execution. State: ${controller.state}`
      );
    }

    // Gather inputs from dependencies
    const inputs = this.#gatherInputsForNode(id);

    // Execute the node
    controller.state = "running";
    try {
      const result = await this.nodeLogic.invoke(controller.node, inputs);

      if (!ok(result)) {
        controller.afterInvoking(false);
        return result;
      }

      // Store outputs in cache
      this.#storeOutputsForNode(id, result);
      controller.afterInvoking(true);

      return result;
    } catch (error) {
      controller.afterInvoking(false);
      return err(error instanceof Error ? error.message : `${error}`);
    }
  }

  /**
   * Clears the results cache for the specified node.
   */
  clearResultsForNode(id: NodeIdentifier): void {
    this.cache.delete(id);
    const controller = this.controllers.get(id);
    if (controller) {
      controller.state = "waiting";
    }
  }

  /**
   * Clears the results cache
   */
  clearResults(): void {
    this.cache.clear();
    for (const controller of this.controllers.values()) {
      controller.state = "waiting";
    }
  }

  /**
   * Initiates a graph run using the data currently in the results cache.
   * The run must proceed in stages defined by the ExecutionPlan. Each stage
   * denotes nodes that can run in parallel and each stage must be completed
   * in sequence.
   * Only nodes whose state is not Succeeded or Cached will be executed.
   * The system will scan through the stages, find the Ready nodes based on
   * their availability in the cache and begin execution from there.
   */
  async run(): Promise<Outcome<void>> {
    for (const stage of this.plan.stages) {
      if (stage.type === "static") {
        // Execute all nodes in this stage in parallel
        const promises: Promise<Outcome<OutputValues>>[] = [];
        const nodeIds: NodeIdentifier[] = [];

        for (const nodeInfo of stage.nodes) {
          const controller = this.controllers.get(nodeInfo.id);
          if (!controller) continue;

          // Check if node needs to be executed
          controller.beforeInvoking(this.cache);

          if (controller.state === "ready") {
            nodeIds.push(nodeInfo.id);
            promises.push(this.runNode(nodeInfo.id));
          }
        }

        // Wait for all nodes in this stage to complete
        const results = await Promise.all(promises);

        // Check for errors
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (!ok(result)) return result;
        }
      } else if (stage.type === "vm") {
        // Handle VM stage (subgraph execution)
        const result = await this.runNode(stage.node.id);
        if (!ok(result)) return result;
      }
    }

    return undefined;
  }

  /**
   * Returns the current state of nodes.
   */
  status(): ExecutionNodeInfo[] {
    const result: ExecutionNodeInfo[] = [];
    for (const [id, controller] of this.controllers.entries()) {
      // Update state, because it could become stale during the execution.
      controller.beforeInvoking(this.cache);
      result.push({ id, state: controller.state });
    }
    return result;
  }
}
