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
   * Type of the node. What does node do?
   */
  type: NodeTypeIdentifier;
  /**
   * A list of Node's declared outputs. Outputs are where graph edges
   * originate from.
   */
  inputs: InputIdentifier[];
  /**
   * A list of Node's declared inputs. Inputs are where graph edges arrive at.
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

export type OutputValues = Record<OutputIdentifier, unknown>;

export type NodeHandler = (inputs: InputValues) => OutputValues;

export type NodeHandlers = Record<NodeTypeIdentifier, NodeHandler>;

const wire = (edge: Edge, outputs: OutputValues): InputValues => {
  console.log(
    `wire "${edge.from.output}" output as input "${edge.to.input}" of node "${edge.to.node}"`
  );
  return {
    [edge.to.input]: outputs[edge.from.output],
  };
};

/**
 * The dumbest possible edge follower.
 * @param graph graph to follow
 */
export const follow = (graph: GraphDescriptor, nodeHandlers: NodeHandlers) => {
  let edge = graph.edges.find((edge) => edge.entry);
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
    const nodeHandler = nodeHandlers[current.type];
    outputs = nodeHandler?.(inputs ?? {});
    inputs = wire(edge, outputs);
    next = edge.to.node;
    edge = graph.edges.find((edge) => edge.from.node == next);
  }
  if (next) {
    const last = nodes[next];
    const nodeHandler = nodeHandlers[last.type];
    nodeHandler?.(inputs ?? {});
  }
};
