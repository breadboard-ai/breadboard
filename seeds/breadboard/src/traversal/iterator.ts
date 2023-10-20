/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  CompletedNodeOutput,
  TraversalResult,
  ErrorCapability,
  OutputValues,
} from "../types.js";
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

    // If there was an error, ignore all other outputs and hence opportunites.
    const opportunities = outputs.$error
      ? newOpportunities.filter((e) => e.out === "$error")
      : newOpportunities;

    // Process outputs.
    result.opportunities.push(...opportunities);
    result.state.wireOutputs(opportunities, outputs);

    if (outputs.$error && opportunities.length === 0) {
      // If the node threw an exception and it wasn't routed via $error,
      // throw it again. This will cause the traversal to stop.
      throw new Error(
        "Uncaught exception in node handler. Catch by wiring up the $error output.",
        {
          cause: outputs.$error,
        }
      );
    }
  }

  static async processAllPendingNodes(
    result: TraversalResult
  ): Promise<TraversalResult> {
    const completed = await Promise.all(result.pendingOutputs.values());
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
      const { inputs, outputsPromise, newOpportunities, descriptor } =
        this.#current;

      // Mark inputs as used, i.e. shift inputs queues.
      this.#current.state.useInputs(descriptor.id, this.#current.inputs);

      const promiseId = Symbol();
      const promise = new Promise((resolve) => {
        (outputsPromise || Promise.resolve({} as OutputValues))
          .then((outputs: OutputValues) => {
            // If not already present, add inputs and descriptor along for
            // context and to support retries. If $error came from another node,
            // the descriptor will remain the original, but new inputs will be
            // added, though never overwriting prior ones.
            if (outputs.$error) {
              const $error = outputs.$error as ErrorCapability;
              outputs.$error = {
                descriptor,
                ...($error as object),
                inputs: { ...inputs, ...$error.inputs },
              };
            }
            resolve({ promiseId, outputs, newOpportunities });
          })
          .catch((error) => {
            // If the handler threw an exception, turn it into a $error output.
            // Pass the inputs and descriptor along for context and to support
            // retries. This Promise will hence always resolve.
            resolve({
              promiseId,
              outputs: {
                $error: {
                  kind: "error",
                  error,
                  inputs,
                  descriptor,
                } as ErrorCapability,
              },
              newOpportunities: newOpportunities.filter(
                (edge) => edge.out === "$error"
              ),
            });
          });
      }) as Promise<CompletedNodeOutput>;

      this.#current.pendingOutputs.set(promiseId, promise);
    }

    // If there are no more opportunites or we've disabled parallel execution,
    // let's wait for pending nodes to be done
    while (
      (this.#current.opportunities.length === 0 || this.#noParallelExecution) &&
      this.#current.pendingOutputs.size > 0
    ) {
      // Wait for the first pending node to be done.
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
