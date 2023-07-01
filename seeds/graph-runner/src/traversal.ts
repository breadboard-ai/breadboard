/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeDescriptor,
  NodeIdentifier,
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  OutputValues,
  NodeHandlers,
} from "./types.js";

const wire = (heads: Edge[], outputs: OutputValues): InputValues => {
  const result: InputValues = {};
  heads.forEach((head) => {
    const out = head.out;
    if (!out) return;
    if (out === "*") {
      Object.assign(result, outputs);
      return;
    }
    const output = outputs[head.out];
    if (output) result[head.in] = outputs[head.out];
  });
  return result;
};

const handle = async (
  nodeHandlers: NodeHandlers,
  descriptor: NodeDescriptor,
  context: GraphTraversalContext,
  inputs?: InputValues | null
) => {
  const handler = nodeHandlers[descriptor.type];
  if (!handler)
    throw new Error(`No handler for node type "${descriptor.type}"`);

  const aggregate = { ...descriptor.configuration, ...inputs };
  const result = await handler(context, aggregate);
  return result;
};

/**
 * Additional concept: whether or not an output was consumed by the intended
 * input.
 * State stores all outputs that have not yet been consumed, organized as
 * a map of maps:
 */
class StateManager {
  #state = new Map();

  update(node: NodeIdentifier, opportunities: Edge[], outputs: OutputValues) {
    // 1. Clear entries for the current node.
    this.#state.delete(node);
    // 2. Add entries for each opportunity.
    opportunities.forEach((opportunity) => {
      const toNode = opportunity.to;
      let fromNodeMap = this.#state.get(toNode);
      if (!fromNodeMap) {
        fromNodeMap = new Map();
        this.#state.set(toNode, fromNodeMap);
      }
      fromNodeMap.set(opportunity.from, outputs);
    });
    // console.log("== State after update", this.#state);
  }

  getAvailableOutputs(node: NodeIdentifier) {
    const edges: Map<NodeIdentifier, OutputValues> = this.#state.get(node);
    const result: OutputValues = {};
    if (!edges) return result;
    for (const outputs of edges.values()) {
      Object.assign(result, outputs);
    }
    // console.log("== Available outputs:", result);
    return result;
  }
}

const computeMissingInputs = (
  heads: Edge[],
  inputs: InputValues,
  current: NodeDescriptor
) => {
  const requiredInputs: string[] = heads
    .filter((edge: Edge) => !!edge.in && !edge.optional)
    .map((edge: Edge) => edge.in);
  // console.log("== Required inputs:", requiredInputs);
  const inputsWithConfiguration = new Set();
  Object.keys(inputs).forEach((key) => inputsWithConfiguration.add(key));
  if (current.configuration) {
    Object.keys(current.configuration).forEach((key) =>
      inputsWithConfiguration.add(key)
    );
  }
  return requiredInputs.filter((input) => !inputsWithConfiguration.has(input));
};

/**
 * A slightly less dumb, but incredibly unkempt edge follower.
 * @todo implement nicer traversal, something like a topology sort with feedback problem resolution.
 * @param graph graph to follow
 */

export const traverseGraph = async (
  context: GraphTraversalContext,
  graph: GraphDescriptor
) => {
  const source = "traverseGraph";
  const state = new StateManager();
  const log = context.log;

  /**
   * Tails: a map of all outgoing edges, keyed by node id.
   */
  const tails = graph.edges.reduce((acc, edge) => {
    const from = edge.from;
    acc.has(from) ? acc.get(from)?.push(edge) : acc.set(from, [edge]);
    return acc;
  }, new Map());

  /**
   * Heads: a map of all incoming edges, keyed by node id.
   */
  const heads = graph.edges.reduce((acc, edge) => {
    const to = edge.to;
    acc.has(to) ? acc.get(to)?.push(edge) : acc.set(to, [edge]);
    return acc;
  }, new Map());

  /**
   * Nodes: a map of all nodes, keyed by node id.
   */
  const nodes = graph.nodes.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {} as Record<NodeIdentifier, NodeDescriptor>);

  log({
    source,
    type: "traversal-start",
    text: "Stargate traversal",
  });

  const entries = Array.from(tails.keys()).filter(
    (node) => !heads.has(node) || heads.get(node).length === 0
  );
  if (entries.length === 0) throw new Error("No entry node found in graph.");
  // Create fake edges to represent entry points.
  const opportunities = entries.map((entry) => ({
    from: "$entry",
    in: "",
    to: entry,
    out: "",
  }));

  while (opportunities.length > 0) {
    const opportunity = opportunities.shift() as Edge;

    const toNode: NodeIdentifier = opportunity.to;
    const current = nodes[toNode];

    if (!current) throw new Error(`No node found for id "${toNode}"`);

    log({
      source,
      type: "node",
      value: current.id,
      nodeType: current.type,
      text: `Visiting: "${current.id}", type: "${current.type}"`,
    });

    const incomingEdges = heads.get(toNode) || [];
    const inputs = wire(incomingEdges, state.getAvailableOutputs(toNode));
    Object.entries(inputs).forEach(([key, value]) => {
      log({
        source,
        type: "input",
        key,
        value: JSON.stringify(value),
        text: `- Input "${key}": ${value}`,
      });
    });

    const missingInputs = computeMissingInputs(incomingEdges, inputs, current);
    if (missingInputs.length > 0) {
      log({
        source,
        type: "missing-inputs",
        key: toNode,
        value: JSON.stringify(missingInputs),
        text: `Missing inputs: ${missingInputs.join(
          ", "
        )}, Skipping node "${toNode}"`,
      });
      continue;
    }

    const outputs =
      (await handle(context.handlers, current, context, inputs)) || {};
    // TODO: Make it not a special case.
    const exit = outputs.exit as boolean;
    if (exit) return;

    Object.entries(outputs).forEach(([key, value]) => {
      log({
        source,
        type: "output",
        key,
        value: JSON.stringify(value),
        text: `- Output "${key}": ${value}`,
      });
    });

    const newOpportunities = tails.get(toNode) || [];
    opportunities.push(...newOpportunities);
    opportunities.forEach((opportunity) => {
      log({
        source,
        type: "opportunity",
        value: opportunity.to,
        text: `- Opportunity: "${opportunity.to}"`,
      });
    });

    state.update(toNode, newOpportunities, outputs);
  }
  log({
    source,
    type: "traversal-end",
    text: "Traversal complete",
  });
};
