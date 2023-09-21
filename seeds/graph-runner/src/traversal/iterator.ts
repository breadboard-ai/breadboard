/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, CompletedNodeOutput, TraversalResult } from "../types.js";
import { Traversal } from "./index.js";
import { GraphRepresentation } from "./representation.js";
import { MachineResult } from "./result.js";

export class TraversalMachineIterator
  implements AsyncIterator<TraversalResult>
{
  graph: GraphRepresentation;
  #current: TraversalResult;
  #noParallelExecution: boolean;

  constructor(
    graph: GraphRepresentation,
    result: TraversalResult,
    noParallelExecution = true
  ) {
    this.graph = graph;
    this.#current = result;
    this.#noParallelExecution = noParallelExecution;
  }

  static #processCompletedNode(
    result: TraversalResult,
    completedNodeOutput: CompletedNodeOutput
  ) {
    const { promiseId, outputs, newOpportunities } = completedNodeOutput;
    result.pendingOutputs.delete(promiseId);

    // Process outputs.
    result.opportunities.push(...newOpportunities);
    result.state.wireOutputs(newOpportunities, outputs);
  }

  static async processAllPendingNodes(
    result: TraversalResult
  ): Promise<TraversalResult> {
    console.log(result.pendingOutputs.values());
    const completed = await Promise.all(result.pendingOutputs.values());
    console.log(completed);
    completed.forEach((completedNodeOutput) => {
      TraversalMachineIterator.#processCompletedNode(
        result,
        completedNodeOutput
      );
    });
    return result;
  }

  async next(): Promise<IteratorResult<TraversalResult>> {
    // If there are no missing inputs, let's consume the outputs
    if (!this.#current.skip) {
      const { outputsPromise, newOpportunities, descriptor } = this.#current;

      // Mark inputs as used, i.e. shift inputs queues.
      this.#current.state.useInputs(descriptor.id, this.#current.inputs);

      const promiseId = Symbol();
      const promise = new Promise((resolve, reject) => {
        (outputsPromise || Promise.resolve({}))
          .then((outputs) => {
            resolve({ promiseId, outputs, newOpportunities });
          })
          .catch(reject);
      }) as Promise<CompletedNodeOutput>;

      this.#current.pendingOutputs.set(promiseId, promise);
    }

    // If there are no more opportunites or we've disabled parallel execution,
    // let's wait for pending nodes to be done
    while (
      (this.#current.opportunities.length === 0 || this.#noParallelExecution) &&
      this.#current.pendingOutputs.size > 0
    ) {
      // We use Promise.race here to also get rejected Promises, i.e. runtime
      // errors in a node. As we don't catch the error, it'll propagate when we
      // await it.
      //
      // TODO: Change this to a `$error` output and throw if it isn't handled.
      TraversalMachineIterator.#processCompletedNode(
        this.#current,
        await Promise.race(this.#current.pendingOutputs.values())
      );
    }

    // If there are no more opportunities and none are pending, we're done.
    if (this.#current.opportunities.length === 0)
      return { done: true, value: null };

    // Now, we're ready to start the next iteration.

    // Otherwise, let's pop the next opportunity from the queue.
    const opportunity = this.#current.opportunities.shift() as Edge;

    const { heads, nodes, tails } = this.graph;

    const toNode = opportunity.to;
    const currentDescriptor = nodes.get(toNode);
    if (!currentDescriptor) throw new Error(`No node found for id "${toNode}"`);

    const incomingEdges = heads.get(toNode) || [];
    const inputs = this.#current.state.getAvailableInputs(toNode);

    const missingInputs = Traversal.computeMissingInputs(
      incomingEdges,
      inputs,
      currentDescriptor
    );

    const newOpportunities = tails.get(toNode) || [];
    // Pour configuration values into inputs. These are effectively like
    // constants.
    const inputsWithConfiguration = {
      ...currentDescriptor.configuration,
      ...inputs,
    };

    this.#current = new MachineResult(
      currentDescriptor,
      inputsWithConfiguration,
      missingInputs,
      this.#current.opportunities,
      newOpportunities,
      this.#current.state,
      this.#current.pendingOutputs
    );
    return { done: false, value: this.#current };
  }
}
