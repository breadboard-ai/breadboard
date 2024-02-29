/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Capability {
  readonly kind: string;
}

/**
 * A type representing a valid JSON value.
 */
export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | Capability
  | { [key: string]: NodeValue };

/**
 * Unique identifier of a node in a graph.
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
export type NodeDescriptor = {
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

  /**
   * The metadata of the node.
   * Use this provide additional information about the node.
   */
  metadata?: NodeMetadata;
};

/**
 * Represents an edge in a graph.
 */
export type Edge = {
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
};

/**
 * Represents metadata of a node.
 * This is an optional part of the `NodeDescriptor` that can be used to
 * provide additional information about the node.
 */
export type NodeMetadata = {
  /**
   * The title of the node.
   */
  title?: string;
  /**
   * A more detailed description of the node.
   */
  description?: string;
  /**
   * Metadata that conveys visual informationa about the node. Can be used by
   * visual editors to store information about the node's appearance, current
   * position, etc.
   */
  visual?: NodeValue;
};

/**
 * Represents references to a "kit": a collection of `NodeHandlers`.
 * The basic permise here is that people can publish kits with interesting
 * handlers, and then graphs can specify which ones they use.
 * The `@google-labs/core-kit` package is an example of kit.
 */
export type KitReference = {
  /**
   * The URL pointing to the location of the kit.
   */
  url: string;
};

export type KitDescriptor = KitReference & {
  /**
   * The title of the kit.
   */
  title?: string;
  /**
   * The description of the kit.
   */
  description?: string;
  /**
   * Version of the kit.
   * [semver](https://semver.org/) format is encouraged.
   */
  version?: string;
};

/**
 * Represents graph metadata.
 */
export type GraphMetadata = {
  /**
   * The schema of the graph.
   */
  $schema?: string;

  /**
   * The URL pointing to the location of the graph.
   * This URL is used to resolve relative paths in the graph.
   * If not specified, the paths are assumed to be relative to the current
   * working directory.
   */
  url?: string;
  /**
   * The title of the graph.
   */
  title?: string;
  /**
   * The description of the graph.
   */
  description?: string;
  /**
   * Version of the graph.
   * [semver](https://semver.org/) format is encouraged.
   */
  version?: string;
};

/**
 * Unique identifier of a graph.
 */
export type GraphIdentifier = string;

/**
 * Represents a collection of sub-graphs.
 * The key is the identifier of the sub-graph.
 * The value is the descriptor of the sub-graph.
 */
export type SubGraphs = Record<GraphIdentifier, GraphDescriptor>;

/**
 * Represents a graph.
 */
export type GraphDescriptor = GraphMetadata & {
  /**
   * The collection of all edges in the graph.
   */
  edges: Edge[];

  /**
   * The collection of all nodes in the graph.
   */
  nodes: NodeDescriptor[];

  /**
   * All the kits (collections of node handlers) that are used by the graph.
   */
  kits?: KitReference[];

  /**
   * Sub-graphs that are also described by this graph representation.
   */
  graphs?: SubGraphs;

  /**
   * Arguments that are passed to the graph, useful to bind values to lambdas.
   */
  args?: InputValues;
};

/**
 * Values that are supplied as inputs to the `NodeHandler`.
 */
export type InputValues = Record<InputIdentifier, NodeValue>;

/**
 * Values that the `NodeHandler` outputs.
 */
export type OutputValues = Partial<Record<OutputIdentifier, NodeValue>>;

/**
 * Values that are supplied as part of the graph. These values are merged with
 * the `InputValues` and supplied as inputs to the `NodeHandler`.
 */
export type NodeConfiguration = Record<string, NodeValue>;
