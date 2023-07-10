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

/**
 * Unique identifier of a node's type.
 */
export type NodeTypeIdentifier = string;

/**
 * Represents a node in a graph.
 */
export interface NodeDescriptor {
  /**
   * Unique id of the node in graph.
   */
  id: NodeIdentifier;

  /**
   * Type of the node. Used to look up the handler for the node.
   */
  type: NodeTypeIdentifier;

  /**
   * Configuration of the node.
   */
  configuration?: NodeConfiguration;
}

/**
 * Represents an edge in a graph.
 */
export interface Edge {
  /**
   * The node that the edge is coming from.
   */
  from: NodeIdentifier;

  /**
   * The node that the edge is going to.
   */
  to: NodeIdentifier;

  /**
   * The input of the `to` node. If this value is undefined, then
   * the then no data is passed as output of the `from` node.
   */
  in?: InputIdentifier;

  /**
   * The output of the `from` node. If this value is "*", then all outputs
   * of the `from` node are passed to the `to` node. If this value is undefined,
   * then no data is passed to any inputs of the `to` node.
   */
  out?: OutputIdentifier;

  /**
   * If true, this edge is optional: the data that passes through it is not
   * considered a required input to the node.
   */
  optional?: boolean;

  /**
   * If true, this edge acts as a constant: the data that passes through it
   * remains available even after the node has consumed it.
   */
  constant?: boolean;
}

/**
 * Represents a graph.
 */
export interface GraphDescriptor {
  /**
   * The collection of all edges in the graph.
   */
  edges: Edge[];

  /**
   * The collection of all nodes in the graph.
   */
  nodes: NodeDescriptor[];
}

/**
 * Values that are supplied as inputs to the `NodeHandler`.
 */
export type InputValues = Record<InputIdentifier, unknown>;

/**
 * Values that the `NodeHandler` outputs.
 */
export type OutputValues = Partial<Record<OutputIdentifier, unknown>>;

/**
 * Values that are supplied as part of the graph. These values are merged with
 * the `InputValues` and supplied as inputs to the `NodeHandler`.
 */
export type NodeConfiguration = Record<string, unknown>;

/**
 * A function that represents a type of a node in the graph.
 */
export type NodeHandler = (
  /**
   * The context of the graph traversal.
   */
  context: GraphTraversalContext,

  /**
   * The inputs that are supplied to the node.
   */
  inputs: InputValues
) => Promise<OutputValues | void>;

/**
 * All known node handlers.
 */
export type NodeHandlers = Record<NodeTypeIdentifier, NodeHandler>;

/**
 * Convenience type fo representing data to be logged.
 */
export type LogData = Record<string, string | number | string[]>;

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
  requestExternalInput(inputs: InputValues): Promise<OutputValues>;

  /**
   * This is how the nodes provide output outside of the graph.
   * For example, for a command-line interface context, we might be printing
   * the values to the console.
   * @param inputs the values that the node wants to output.
   * @returns nothing.
   */
  provideExternalOutput(inputs: InputValues): Promise<void>;

  /**
   * This is how nodes are able to handle slotted content. Inovking this method
   * will traverse the graph with the given slot name, with provided inputs.
   * @param slot the name of the slotted subgraph the node wants to traverse.
   * @param inputs the inputs supplied to the subgraph.
   * @returns results of the traversl.
   */
  requestSlotOutput(slot: string, inputs: InputValues): Promise<OutputValues>;

  /**
   * This is only called by the `traverseGraph` function.
   * @todo make this non-callable by other consumers of context.
   * @param graph The graph to set as the current graph.
   * @returns nothing
   */
  setCurrentGraph(graph: GraphDescriptor): Promise<void>;

  /**
   * This is how a node is able to see the graph that it is a part of.
   * @returns the `GraphDescriptor` of the graph that is currently being
   * traversed.
   */
  getCurrentGraph(): Promise<GraphDescriptor>;

  /**
   * A logging facility. Currently, `traverseGraph` uses it to log
   * various interesting events, and it's quite chatty. Good for
   * "see details" logs and is very disorganized at the moment.
   * @todo make logging more organized.
   */
  log(data: LogData): Promise<void>;
}
