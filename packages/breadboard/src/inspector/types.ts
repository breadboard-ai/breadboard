/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphDescriptor,
  InputValues,
  Kit,
  KitDescriptor,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  Schema,
} from "../types.js";

export type InspectableNode = {
  /**
   * The `NodeDescriptor` for the node.
   */
  descriptor: NodeDescriptor;
  /**
   * The title of the node. Use this to get a consistent name for the node.
   * When the node has a title in the `NodeMetadata`, will be used.
   * Otherwise, the id of the node will be used.
   */
  title(): string;
  /**
   * Returns the nodes that have an edge to this node.
   */
  incoming(): InspectableEdge[];
  /**
   * Returns the nodes that have an edge from this node.
   */
  outgoing(): InspectableEdge[];
  /**
   * Return true if the node is an entry node (no incoming edges)
   */
  isEntry(): boolean;
  /**
   * Return true if the node is an exit node (no outgoing edges)
   */
  isExit(): boolean;

  /**
   * Returns the API of the node.
   *
   * A note about the relationship between `describe`, `subgraph.describe`,
   * and `incoming`/`outgoing`:
   * - the `describe` returns the API as the node itself expects it
   * - the `incoming` and `outgoing` return the actual wires going in/out
   * - the `subgraph.describe` returns the API of the subgraph that the node
   *   contains (or represents). For instance, the `invoke` node has a `path`
   *   required property. This property will show up in `describe` (since it
   *   specifies the path of the graph), but not in `subgraph.describe` (since
   *   the subgraph itself doesn't actually use it).
   *
   * This function is designed to match the output of the
   * `NodeDescriberFunction`.
   */
  describe(inputs?: InputValues): Promise<NodeDescriberResult>;
  /**
   * Returns configuration of the node.
   * TODO: Use a friendlier to inspection return type.
   */
  configuration(): NodeConfiguration;
  /**
   * Returns the current state of node's ports
   */
  ports(inputs?: InputValues): Promise<InspectableNodePorts>;
};

export type InspectableEdge = {
  /**
   * The outgoing node of the edge.
   */
  from: InspectableNode;
  /**
   * The name of the port of the outgoing edge.
   */
  out: string;
  /**
   * The incoming node of the edge.
   */
  to: InspectableNode;
  /**
   * The name of the port of the incoming edge.
   */
  in: string;
};

export type InspectableGraph = {
  /**
   * Returns the underlying `GraphDescriptor` object.
   * TODO: Replace all uses of it with a proper inspector API.
   */
  raw(): GraphDescriptor;
  /**
   * Returns the node with the given id, or undefined if no such node exists.
   * @param id id of the node to find
   */
  nodeById(id: NodeIdentifier): InspectableNode | undefined;
  /**
   * Returns all nodes in the graph.
   */
  nodes(): InspectableNode[];
  /**
   * Returns all edges of the graph.
   */
  edges(): InspectableEdge[];
  /**
   * Returns true if the edge exists in the graph.
   */
  hasEdge(edge: Edge): boolean;
  /**
   * Returns all kits in the graph.
   */
  kits(): InspectableKit[];
  /**
   * Returns all nodes of the given type.
   * @param type type of the nodes to find
   */
  nodesByType(type: NodeTypeIdentifier): InspectableNode[];
  /**
   * Describe a given type of the node
   */
  describeType(
    type: NodeTypeIdentifier,
    options?: NodeTypeDescriberOptions
  ): Promise<NodeDescriberResult>;
  /**
   * Returns the nodes that have an edge to the node with the given id.
   * @param id id of the node to find incoming nodes for
   */
  incomingForNode(id: NodeIdentifier): InspectableEdge[];
  /**
   * Returns the nodes that have an edge from the node with the given id.
   * @param id id of the node to find outgoing nodes for
   */
  outgoingForNode(id: NodeIdentifier): InspectableEdge[];
  /**
   * Returns a list of entry nodes for the graph.
   */
  entries(): InspectableNode[];
  /**
   * Returns the API of the graph. This function is designed to match the
   * output of the `NodeDescriberFunction`.
   */
  describe(): Promise<NodeDescriberResult>;
};

/**
 * Options to supply to the `inspectableGraph` function.
 */
export type InspectableGraphOptions = {
  /**
   * Optional, a list of kits to use when inspecting the graph. If not
   * supplied, the graph will be inspected without any kits.
   */
  kits?: Kit[];
};

/**
 * Options to supply to the `describeType` function.
 */
export type NodeTypeDescriberOptions = {
  /**
   * Optional, the inputs to the node.
   */
  inputs?: InputValues;
  /**
   * Optional, the incoming edges to the node.
   */
  incoming?: InspectableEdge[];
  /**
   * Optional, the outgoing edges from the node.
   */
  outgoing?: InspectableEdge[];
};

/**
 * Describes the current status of a node port.
 */
export enum PortStatus {
  /**
   * The port status impossible to determine. This only happens when the node
   * has a star wire ("*") and the port is not connected.
   */
  Inteterminate = "indeterminate",
  /**
   * The port is correctly connected to another node or specified using node's
   * configuration, according to this node's schema.
   */
  Connected = "connected",
  /**
   * The port is not connected to another node, and it is expected, but not
   * required by the node's schema.
   */
  Ready = "ready",
  /**
   * The port is not connected to another node, but it is required by the node's
   * schema. It is similar to "Ready", except that not having this port
   * connected is an error.
   */
  Missing = "missing",
  /**
   * The port is connected to this node, but it is not expected by the node's
   * schema. This is an error state.
   */
  Dangling = "dangling",
}

/**
 * Describes a node port (input or output).
 */
export type InspectablePort = {
  /**
   * The name of the port.
   */
  name: string;
  /**
   * Returns current status of this port.
   */
  status: PortStatus;
  /**
   * Returns true if the port was specified in the node's configuration.
   */
  configured: boolean;
  /**
   * Returns true if this is the star port ("*").
   */
  star: boolean;
  /**
   * Port schema as defined by the node's configuration.
   */
  schema: Schema | undefined;
  /**
   * Returns the edges connected to this port.
   */
  edges: InspectableEdge[];
};

/**
 * Represents one side (input or output) of ports of a node.
 */
export type InspectablePortList = {
  /**
   * Input ports of the node.
   */
  ports: InspectablePort[];
  /**
   * Returns true if the list of ports is fixed. Returns false if the node
   * expects a dynamic number of ports.
   *
   * Fixed example: the `validateJson` node, which has two fixed input ports:
   * `json` and `schema`.
   *
   * Conversely, the `core.invoke` node is an example of the dynamic number of
   * ports, which can take any number of inputs and they are passed to the
   * invoked graph as arguments.
   */
  fixed: boolean;
};

/**
 * Represents the input and output ports of a node.
 */
export type InspectableNodePorts = {
  /**
   * Returns the input ports of the node.
   */
  inputs: InspectablePortList;
  /**
   * Returns the output ports of the node.
   */
  outputs: InspectablePortList;
};

/**
 * Represents a Breadboard Kit associated with the board.
 */
export type InspectableKit = {
  /**
   * Returns the descriptor of the kit.
   */
  descriptor: KitDescriptor;
  /**
   * Returns the node types of the kit.
   */
  nodeTypes: InspectableNodeType[];
};

export type InspectableNodeType = {
  /**
   * Returns the type of the node.
   */
  type(): NodeTypeIdentifier;
  /**
   * Returns the ports of the node.
   */
  ports(): Promise<InspectableNodePorts>;
};

/**
 * Represents a simple listener for edits to the graph.
 * An instance of this type is returned by the `editReceiver` method of
 * `InspectableGraph`.
 */
export type GraphStoreMutator = {
  nodeStore: NodeStoreMutator;
  edgeStore: EdgeStoreMutator;
};

export type NodeStoreMutator = {
  add(node: NodeDescriptor): void;
  remove(id: NodeIdentifier): void;
};

export type EdgeStoreMutator = {
  add(edge: Edge): void;
  remove(edge: Edge): void;
};

export type InspectableGraphWithStore = InspectableGraph & GraphStoreMutator;
