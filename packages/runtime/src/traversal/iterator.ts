/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  ErrorCapability,
  GraphRepresentation,
  TraversalResult,
} from "@breadboard-ai/types";
import { Traversal } from "./index.js";
import { MachineResult } from "./result.js";

export class TraversalMachineIterator
  implements AsyncIterator<TraversalResult>
{
  graph: GraphRepresentation;
  #current: TraversalResult;

  constructor(graph: GraphRepresentation, result: TraversalResult) {
    this.graph = graph;
    this.#current = result;
  }

  async next(): Promise<IteratorResult<TraversalResult>> {
    // If there are no missing inputs, let's consume the outputs
    if (!this.#current.skip) {
      const { inputs, descriptor } = this.#current;
      let { outputs, newOpportunities } = this.#current;

      // Mark inputs as used, i.e. shift inputs queues.
      this.#current.state.useInputs(descriptor.id, this.#current.inputs);

      if (outputs && outputs.$error) {
        const $error = (
          typeof outputs.$error === "string"
            ? { error: new Error(outputs.$error) }
            : outputs.$error
        ) as ErrorCapability;
        outputs.$error = {
          descriptor,
          ...($error as object),
          inputs: { ...inputs, ...$error.inputs },
        };
        newOpportunities = newOpportunities.filter(
          (edge) => edge.out === "$error"
        );
      }

      outputs ??= {};

      // Process outputs.
      this.#current.opportunities.push(...newOpportunities);
      this.#current.state.wireOutputs(newOpportunities, outputs);

      if (outputs.$error) {
        if (newOpportunities.length === 0) {
          // If the node threw an exception and it wasn't routed via $error,
          // throw it again. This will cause the traversal to stop.
          throw new Error(
            "Uncaught exception in node handler. Catch by wiring up the $error output.",
            {
              cause: outputs.$error,
            }
          );
        } else {
          console.warn(
            "Error in node handler, passing to the wired $error output.",
            outputs.$error,
            newOpportunities
          );
        }
      }
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
      currentDescriptor,
      this.graph.start
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
      opportunity,
      this.#current.opportunities,
      newOpportunities,
      this.#current.state
    );
    return { done: false, value: this.#current };
  }
}
