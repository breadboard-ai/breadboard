/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  EdgeMap,
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  NodeIdentifier,
  OutputValues,
} from "../types.js";
import { TraversalStateManager } from "./state.js";

class GraphRepresentation {
  /**
   * Tails: a map of all outgoing edges, keyed by node id.
   */
  tails: Map<NodeIdentifier, Edge[]> = new Map();

  /**
   * Heads: a map of all incoming edges, keyed by node id.
   */
  heads: Map<NodeIdentifier, Edge[]> = new Map();

  /**
   * Nodes: a map of all nodes, keyed by node id.
   */
  nodes: Map<NodeIdentifier, NodeDescriptor> = new Map();

  /**
   * Entries: a list of all nodes that have no incoming edges.
   */
  entries: NodeIdentifier[] = [];

  constructor(descriptor: GraphDescriptor) {
    this.tails = descriptor.edges.reduce((acc, edge) => {
      const from = edge.from;
      acc.has(from) ? acc.get(from)?.push(edge) : acc.set(from, [edge]);
      return acc;
    }, new Map());

    this.heads = descriptor.edges.reduce((acc, edge) => {
      const to = edge.to;
      acc.has(to) ? acc.get(to)?.push(edge) : acc.set(to, [edge]);
      return acc;
    }, new Map());

    this.nodes = descriptor.nodes.reduce((acc, node) => {
      acc.set(node.id, node);
      return acc;
    }, new Map());

    this.entries = Array.from(this.tails.keys()).filter(
      (node) => !this.heads.has(node) || this.heads.get(node)?.length === 0
    );
  }
}

class MachineResult {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs: string[] = [];
  newOpportunities: Edge[] = [];
  outputs?: OutputValues;

  constructor(
    descriptor: NodeDescriptor,
    inputs: InputValues,
    missingInputs: string[],
    newOpportunities: Edge[]
  ) {
    this.descriptor = descriptor;
    this.inputs = inputs;
    this.missingInputs = missingInputs;
    this.newOpportunities = newOpportunities;
  }

  get skip(): boolean {
    return this.missingInputs.length > 0;
  }
}

const emptyResult = new MachineResult(
  { id: "$empty", type: "$empty" },
  {},
  [],
  []
);

export class TraversalMachine
  implements AsyncIterable<MachineResult>, AsyncIterator<MachineResult>
{
  descriptor: GraphDescriptor;
  state: TraversalStateManager;
  graph: GraphRepresentation;
  opportunities: Edge[] = [];
  #current: MachineResult = emptyResult;

  constructor(descriptor: GraphDescriptor) {
    this.descriptor = descriptor;
    this.state = new TraversalStateManager();
    this.graph = new GraphRepresentation(descriptor);
  }

  [Symbol.asyncIterator](): AsyncIterator<MachineResult> {
    return this.start();
  }

  get done(): boolean {
    return this.#current === emptyResult;
  }

  get value(): MachineResult {
    return this.#current;
  }

  async next(): Promise<IteratorResult<MachineResult>> {
    // If this is not the first iteration, let's consume the outputs.
    // Only do so when there are no missing inputs.
    if (this.#current !== emptyResult && !this.#current.skip) {
      const { outputs, newOpportunities, descriptor } = this.#current;
      // Throw if the outputs weren't provided.
      if (!outputs)
        throw new Error("No outputs provided. Next iteration is impossible.");
      if (!descriptor)
        throw new Error(
          "The descriptor is missing. Did you mean to delete it?"
        );

      this.opportunities.push(...newOpportunities);
      this.state.update(descriptor.id, newOpportunities, outputs);
    }

    // Now, we're ready to start the next iteration.
    // If there are no more opportunities, we're done.
    if (this.opportunities.length === 0) {
      this.#current = emptyResult;
      return this;
    }

    // Otherwise, let's pop the next opportunity from the queue.
    const opportunity = this.opportunities.shift() as Edge;

    const { heads, nodes, tails } = this.graph;

    const toNode: NodeIdentifier = opportunity.to;
    const currentDescriptor = nodes.get(toNode);
    if (!currentDescriptor) throw new Error(`No node found for id "${toNode}"`);

    const incomingEdges = heads.get(toNode) || [];
    const inputs = TraversalMachine.wire(
      incomingEdges,
      this.state.getAvailableOutputs(toNode)
    );
    const missingInputs = TraversalMachine.computeMissingInputs(
      incomingEdges,
      inputs,
      currentDescriptor
    );

    const newOpportunities = tails.get(toNode) || [];

    this.#current = new MachineResult(
      currentDescriptor,
      inputs,
      missingInputs,
      newOpportunities
    );
    return this;
  }

  start(): TraversalMachine {
    const { entries } = this.graph;
    if (entries.length === 0) throw new Error("No entry node found in graph.");
    // Create fake edges to represent entry points.
    this.opportunities = entries.map((entry) => ({
      from: "$entry",
      to: entry,
    }));
    return this;
  }

  static wire(heads: Edge[], outputEdges: EdgeMap): InputValues {
    const result: InputValues = {};
    heads.forEach((head) => {
      const from = head.from;
      const outputs = outputEdges.get(from) || {};
      const out = head.out;
      if (!out) return;
      if (out === "*") {
        Object.assign(result, outputs);
        return;
      }
      const output = outputs[out];
      const input = head.in;
      if (!input) return;
      if (output) result[input] = outputs[out];
    });
    return result;
  }

  static computeMissingInputs(
    heads: Edge[],
    inputs: InputValues,
    current: NodeDescriptor
  ) {
    const requiredInputs: string[] = [
      ...new Set(
        heads
          .filter((edge: Edge) => !!edge.in && !edge.optional)
          .map((edge: Edge) => edge.in || "")
      ),
    ];
    const inputsWithConfiguration = new Set();
    Object.keys(inputs).forEach((key) => inputsWithConfiguration.add(key));
    if (current.configuration) {
      Object.keys(current.configuration).forEach((key) =>
        inputsWithConfiguration.add(key)
      );
    }
    return requiredInputs.filter(
      (input) => !inputsWithConfiguration.has(input)
    );
  }
}
