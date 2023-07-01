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

export interface Edge {
  /**
   * The designated first edge in the graph.
   */
  from: NodeIdentifier;
  to: NodeIdentifier;
  in: InputIdentifier;
  out: OutputIdentifier;
  optional?: boolean;
}

export interface GraphDescriptor {
  edges: Edge[];
  nodes: NodeDescriptor[];
}

export type InputValues = Record<InputIdentifier, unknown>;

export type OutputValues = Partial<Record<OutputIdentifier, unknown>>;

export type NodeConfiguration = Record<string, unknown>;

export type NodeHandler = (
  context: GraphTraversalContext,
  inputs: InputValues
) => Promise<OutputValues | void>;

export type NodeHandlers = Record<NodeTypeIdentifier, NodeHandler>;

/**
 * This represents the context of a graph traversal, Supply an instance of a
 * class that implements this interface to the `traverseGraph` function.
 */
export interface GraphTraversalContext {
  /**
   * Key-value pairs of NodeHandlers. Each `NodeHandler` is a function that
   * represents a type of a node in the graph. The key is the type of the node,
   * and the value is the function.
   */
  handlers: NodeHandlers;

  /**
   * This is the means by which nodes request inputs outside of the graph.
   * For example, for a command-line interface context, we might implement
   * asking for user input in this function.
   * @param inputs the inputs that the node is asking for
   * @returns the outputs that we give to the graph
   */
  requestExternalInput: (inputs: InputValues) => Promise<OutputValues>;

  /**
   * This is how the nodes provide output outside of the graph.
   * For example, for a command-line interface context, we might be printing
   * the values to the console.
   * @param inputs the values that the node wants to output.
   * @returns nothing.
   */
  provideExternalOutput: (inputs: InputValues) => Promise<void>;

  /**
   * This is how nodes are able to handle slotted content. Inovking this method
   * will traverse the graph with the given slot name, with provided inputs.
   * @param slot the name of the slotted subgraph the node wants to traverse.
   * @param inputs the inputs supplied to the subgraph.
   * @returns results of the traversl.
   */
  requestSlotOutput: (
    slot: string,
    inputs: InputValues
  ) => Promise<OutputValues>;

  /**
   * A logging facility. Currently, `traverseGraph` uses it to log
   * various interesting events, and it's quite chatty. Good for
   * "see details" logs and is very disorganized at the moment.
   * @todo make logging more organized.
   */
  log: (s: string) => void;
}
