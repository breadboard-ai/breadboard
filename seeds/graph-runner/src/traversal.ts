/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TraversalStateManager } from "./traversal/state.js";
import type {
  Edge,
  NodeDescriptor,
  NodeIdentifier,
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  NodeHandlers,
  EdgeMap,
} from "./types.js";

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
  const state = new TraversalStateManager();
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

  // "entry" stage: entry opportunities are populated.
  // available for inspection:
  // - opportunities -- current list of opportunities.

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

    // "pre-handle" stage: current oportunity identified, inputs are wired,
    // missing inputs are computed.
    // available for inspection:
    // - opportunity -- current node.
    // - incomingEdges -- incoming edges for the opportunity.
    // - availableOutputs -- available outputs for the opportunity.
    // - inputs -- inputs for the opportunity (as wired from availableOutputs).
    // - missingInputs -- inputs that are missing for the opportunity.
    // - decision -- decision whether the opportunity will be skipped.

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
    const opportunitiesTo = opportunities.map((opportunity) => opportunity.to);
    log({
      source,
      type: "opportunities",
      value: opportunitiesTo,
      text: `Opportunities: ${opportunitiesTo.join(", ")}`,
    });

    // "post-handle" stage: opportunity handler called, new opportunities
    // identified, outputs are produced.
    // available for inspection:
    // - opportunity -- current node.
    // - outgoingEdges -- outgoing edges for the taken opportunity
    //   (new opportunities)
    // - outputs -- outputs produced by the opportunity handler.

    state.update(toNode, newOpportunities, outputs);
  }

  // "exit" stage: no more opportunities.
  // available for inspection:
  // none.

  log({
    source,
    type: "traversal-end",
    text: "Traversal complete",
  });
};
