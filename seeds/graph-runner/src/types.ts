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

export interface GraphTraversalContext {
  handlers: NodeHandlers;
  requestExternalInput: (inputs: InputValues) => Promise<OutputValues>;
  provideExternalOutput: (inputs: InputValues) => Promise<void>;
  log: (s: string) => void;
}
