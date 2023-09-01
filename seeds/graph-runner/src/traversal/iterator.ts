/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, TraversalResult } from "../types.js";
import { Traversal } from "./index.js";
import { GraphRepresentation } from "./representation.js";
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
      const { outputs, newOpportunities, descriptor } = this.#current;

      this.#current.opportunities.push(...newOpportunities);
      this.#current.state.update(descriptor.id, newOpportunities, outputs);
    }

    // Now, we're ready to start the next iteration.

    // If there are no more opportunities, we're done.
    if (this.#current.opportunities.length === 0)
      return { done: true, value: null };

    // Otherwise, let's pop the next opportunity from the queue.
    const opportunity = this.#current.opportunities.shift() as Edge;

    const { heads, nodes, tails } = this.graph;

    const toNode = opportunity.to;
    const currentDescriptor = nodes.get(toNode);
    if (!currentDescriptor) throw new Error(`No node found for id "${toNode}"`);

    const incomingEdges = heads.get(toNode) || [];
    const inputs = Traversal.wire(
      incomingEdges,
      this.#current.state.getAvailableOutputs(toNode)
    );

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
      this.#current.state
    );
    return { done: false, value: this.#current };
  }
}
