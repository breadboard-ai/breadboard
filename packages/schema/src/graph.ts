/**
 * @license
 * Copyright 2024 Google LLC
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

export type CommentNode = {
  /**
   * Unique id of the comment node in graph metadata.
   */
  id: NodeIdentifier;

  /**
   * The text content of the comment.
   */
  text: string;

  /**
   * The metadata of the comment node.
   * Use this to provide additional information about the comment node.
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
   * Metadata that conveys visual information about the node. Can be used by
   * visual editors to store information about the node's appearance, current
   * position, etc.
   */
  visual?: NodeValue;
  /**
   * Logging level.
   */
  logLevel?: "debug" | "info";
};

/**
 * Represents references to a "kit": a collection of `NodeHandlers`.
 * The basic premise here is that people can publish kits with interesting
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
   * @pattern ^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$
   */
  version?: string;
};

/**
 * Describes a light kit: a kit where each node is backed by a graph.
 */
export type KitManifest = KitDescriptor & {
  /**
   * A map of nodes. Each key in this object is the node that is provided by
   * the kit. Each value the `GraphDescriptor` containing the graph. This
   * graph will be run (runOnce) when the `invoke` of the node's `NodeHandler`
   * is called.
   */
  nodes: Record<NodeIdentifier, GraphDescriptor>;
};

/**
 * Represents graph metadata that is stored inline in the GraphDescriptor.
 */
export type GraphInlineMetadata = {
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
 * A tag that can be associated with a graph.
 * - `published`: The graph is published (as opposed to a draft). It may be
 *    used in production and shared with others.
 * - `tool`: The graph is intended to be a tool.
 */
export type GraphTag = "published" | "tool";

/**
 * Represents graph metadata.
 */
export type GraphMetadata = {
  /**
   * The icon that identifies the graph. Can be a URL or a Material Design id.
   */
  icon?: string;
  [name: string]: NodeValue;
  comments?: CommentNode[];
  /**
   * Tags associated with the graph. At this moment, free-form strings.
   */
  tags?: GraphTag[];
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
 * Properties used for testing the foundational traversal tests
 * These properties are for internal testing only and should not be used.
 * @deprecated These properties are for internal testing only and should not be used.
 */
type TestProperties = {
  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  inputs?: InputValues;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  outputs?: OutputValues | OutputValues[];

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  sequence?: NodeIdentifier[];

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  throws?: boolean;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  safe?: boolean;

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  expectedLabels?: string[][];

  /**
   * For internal testing only. Do not use.
   * @deprecated For internal testing only. Do not use.
   */
  explanation?: string;
};

/**
 * Represents a graph.
 */
export type GraphDescriptor = GraphInlineMetadata & {
  /**
   * Metadata associated with the graph.
   */
  metadata?: GraphMetadata;
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
  kits?: KitDescriptor[];

  /**
   * Sub-graphs that are also described by this graph representation.
   */
  graphs?: SubGraphs;

  /**
   * Arguments that are passed to the graph, useful to bind values to graphs.
   */
  args?: InputValues;
} & TestProperties;

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
