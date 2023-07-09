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

type EdgeMap = Map<NodeIdentifier, OutputValues>;

const wire = (heads: Edge[], outputEdges: EdgeMap): InputValues => {
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
 * a map of maps
 */
type StateMap = Map<string, Map<string, OutputValues>>;

class StateManager {
  #state: StateMap = new Map();
  #constants: StateMap = new Map();

  #splitOutConstants(edges: Edge[]): [Edge[], Edge[]] {
    const constants: Edge[] = [];
    const rest: Edge[] = [];
    edges.forEach((edge) => {
      if (edge.constant) constants.push(edge);
      else rest.push(edge);
    });
    return [constants, rest];
  }

  #addToState(state: StateMap, opportunities: Edge[], outputs: OutputValues) {
    opportunities.forEach((opportunity) => {
      const toNode = opportunity.to;
      let fromNodeMap = state.get(toNode);
      if (!fromNodeMap) {
        fromNodeMap = new Map();
        state.set(toNode, fromNodeMap);
      }
      fromNodeMap.set(opportunity.from, outputs);
    });
  }

  update(node: NodeIdentifier, opportunities: Edge[], outputs: OutputValues) {
    // 1. Clear entries for the current node.
    // Notice, we're not clearing the "constants" entries. Those are basically
    // there forever -- or until the edge is traversed again.
    this.#state.delete(node);
    const [constants, state] = this.#splitOutConstants(opportunities);
    // 2. Add entries for each opportunity.
    this.#addToState(this.#state, state, outputs);
    this.#addToState(this.#constants, constants, outputs);
  }

  getAvailableOutputs(node: NodeIdentifier) {
    const constantEdges: EdgeMap = this.#constants.get(node) || new Map();
    const stateEdges: EdgeMap = this.#state.get(node) || new Map();
    const result: EdgeMap = new Map([...constantEdges, ...stateEdges]);
    return result;
  }
}

const computeMissingInputs = (
  heads: Edge[],
  inputs: InputValues,
  current: NodeDescriptor
) => {
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
  return requiredInputs.filter((input) => !inputsWithConfiguration.has(input));
};

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
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
  const log = context.log.bind(context);

  context.setCurrentGraph(deepCopy(graph));

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
    text: "Starting traversal",
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

    log({
      source,
      type: "node",
      value: current.id,
      nodeType: current.type,
      text: `Handling: "${current.id}", type: "${current.type}"`,
    });

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
