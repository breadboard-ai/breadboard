/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unique identifier of a node in a graph.
 * @todo Should this be globally unique? Likely a URI.
 */
export type NodeIdentifier = string;

/**
 * Unique identifier of a node's output.
 */
export type OutputIdentifier = string;

/**
 * Unique identifier of a node's input.
 */
export type InputIdentifier = string;

export type NodeTypeIdentifier = string;

/**
 * General node representation.
 */
export interface NodeDescriptor {
  /**
   * Unique id of the node in graph.
   */
  id: NodeIdentifier;
  /**
   * Type of the node. What does this node do?
   */
  type: NodeTypeIdentifier;
  /**
   * Configuration of the node.
   */
  configuration: NodeConfiguration;
}

/**
 * Describes a node type.
 * @todo Currently, `inputs` and `outputs` are fixed. How do we handle flexible number of inputs/outputs?
 */
export interface NodeTypeDescriptor {
  /**
   * A list of Node type's declared outputs. Outputs are where graph edges
   * originate from.
   */
  inputs: InputIdentifier[];
  /**
   * A list of Node type's declared inputs. Inputs are where graph edges arrive at.
   */
  outputs: OutputIdentifier[];
}

export interface FromIdentifier {
  node: NodeIdentifier;
  output: OutputIdentifier;
}

export interface ToIdentifier {
  node: NodeIdentifier;
  input: InputIdentifier;
}

export interface Edge {
  /**
   * The designated first edge in the graph.
   */
  entry?: boolean;
  from: FromIdentifier;
  to: ToIdentifier;
}

export interface GraphDescriptor {
  edges: Edge[];
  nodes: NodeDescriptor[];
}

export type InputValues = Record<InputIdentifier, unknown>;

export type OutputValues = Partial<Record<OutputIdentifier, unknown>>;

export type NodeHandlerResult = OutputValues;

export type NodeConfiguration = Record<string, string>;

export type NodeHandler = (inputs?: InputValues) => Promise<NodeHandlerResult>;

export type NodeHandlers = Record<NodeTypeIdentifier, NodeHandler>;

const wire = (edge: Edge, outputs: OutputValues): InputValues => {
  // console.log(
  //   `wire "${edge.from.output}" output as input "${edge.to.input}" of node "${edge.to.node}"`
  // );
  return {
    [edge.to.input]: outputs[edge.from.output],
  };
};

const handle = async (
  nodeHandlers: NodeHandlers,
  descriptor: NodeDescriptor,
  inputs?: InputValues | null
) => {
  const handler = nodeHandlers[descriptor.type];
  if (!handler)
    throw new Error(`No handler for node type "${descriptor.type}"`);

  const aggregate = { ...descriptor.configuration, ...inputs };
  const result = await handler(aggregate);
  return result;
};

/**
 * Additional concept: whether or not an output was consumed by the intended
 * input.
 * State stores all outputs that have not yet been consumed, organized as
 * a map of maps:
 */
export type State = Map<NodeIdentifier, Map<NodeIdentifier, OutputValues>>;

class StateManager {
  #state = new Map();

  update(node: string, opportunities: Edge[], outputs: OutputValues) {
    // 1. Clear entries for the current node.
    this.#state.delete(node);
    // 2. Add entries for each opportunity.
    opportunities.forEach((opportunity) => {
      const toNode = opportunity.to.node;
      let fromNodeMap = this.#state.get(toNode);
      if (!fromNodeMap) {
        fromNodeMap = new Map();
        this.#state.set(toNode, fromNodeMap);
      }
      fromNodeMap.set(opportunity.from.node, outputs);
    });
    console.log(this.#state);
  }
}

/**
 * The dumbest possible edge follower.
 * @todo implement nicer traversal, something like a topology sort with feedback problem resolution.
 * @param graph graph to follow
 */
export const follow = async (
  graph: GraphDescriptor,
  nodeHandlers: NodeHandlers,
  log: (s: string) => void
) => {
  log(`Let the graph traversal begin!`);

  const state = new StateManager();

  const entry = graph.edges.find((edge) => edge.entry);
  if (!entry) throw new Error("No entry edge found in graph.");
  log(`Starting at node "${entry.from.node}"`);

  /**
   * Tails: a map of all outgoing edges, keyed by node id.
   */
  const tails = graph.edges.reduce((acc, edge) => {
    const from = edge.from.node;
    acc.has(from) ? acc.get(from)?.push(edge) : acc.set(from, [edge]);
    return acc;
  }, new Map());

  /**
   * Nodes: a map of all nodes, keyed by node id.
   */
  const nodes = graph.nodes.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {} as Record<NodeIdentifier, NodeDescriptor>);

  const entryNode = nodes[entry.from.node];
  const handlerResult = await handle(nodeHandlers, entryNode, {});
  // TODO: Make it not a special case.
  const exit = handlerResult.exit as boolean;
  if (exit) return;

  const opportunities = [entry];

  // State of the graph traversal.
  let outputs: OutputValues = handlerResult;

  while (opportunities.length > 0) {
    const opportunity = opportunities.shift() as Edge;

    const toNode: NodeIdentifier = opportunity.to.node;
    const inputs = wire(opportunity, outputs);
    const current = nodes[toNode];

    if (!current) throw new Error(`No node found for id "${toNode}"`);

    log(`Visiting: "${current.id}", type: "${current.type}"`);
    Object.entries(inputs).forEach(([key, value]) => {
      log(`- Input "${key}": ${value}`);
    });

    const handlerResult = await handle(nodeHandlers, current, inputs);
    // TODO: Make it not a special case.
    const exit = handlerResult.exit as boolean;
    if (exit) return;

    outputs = handlerResult;

    Object.entries(outputs).forEach(([key, value]) => {
      log(`- Output "${key}": ${value}`);
    });

    opportunities.push(...tails.get(toNode));
    opportunities.forEach((opportunity) => {
      log(`- Opportunity: "${opportunity.to.node}"`);
    });

    state.update(toNode, opportunities, outputs);
  }
  log("Graph traversal complete.");
};
