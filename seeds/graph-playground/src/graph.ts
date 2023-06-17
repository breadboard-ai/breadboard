/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeIdentifier = string;

export type OutputIdentifier = string;

export type InputIdentifier = string;

export type NodeTypeIdentifier = string;

/**
 * General node representation.
 */
export interface NodeDescriptor {
  /**
   * Unique id of the node in graph.
   * @todo Should this be globally unique? Likely a URI.
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

  let edge = graph.edges.find((edge) => edge.entry);

  log(`Starting at edge "${edge?.from.node}"`);

  let next: NodeIdentifier | null = null;

  // State of the graph traversal.
  let inputs: InputValues | null = null;
  let outputs: OutputValues | null = null;

  const nodes = graph.nodes.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {} as Record<NodeIdentifier, NodeDescriptor>);

  while (edge) {
    const current = nodes[edge.from.node];

    log(`Visiting: "${current.id}", type: "${current.type}"`);

    const handlerResult = await handle(nodeHandlers, current, inputs);
    // TODO: Make it not a special case.
    const exit = handlerResult.exit as boolean;
    if (exit) return;
    outputs = handlerResult;
    inputs = wire(edge, outputs);
    next = edge.to.node;
    edge = graph.edges.find((edge) => edge.from.node == next);
  }
  if (next) {
    const last = nodes[next];
    log(`Visiting final node "${last.id}", type "${last.type}"`);
    await handle(nodeHandlers, last, inputs);
  }
  log("Graph traversal complete.");
};
