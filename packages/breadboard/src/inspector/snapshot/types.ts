/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphIdentifier,
  GraphInlineMetadata,
  GraphMetadata,
  KitDescriptor,
  ModuleCode,
  ModuleIdentifier,
  ModuleMetadata,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeMetadata,
  NodeTypeIdentifier,
  NodeValue,
} from "@breadboard-ai/types";
import { NodeHandlerMetadata, Schema } from "../../types.js";
import {
  TypedEventTarget,
  TypedEventTargetType,
} from "../../utils/typed-event-target.js";
import {
  AddEdgeSpec,
  AddModuleSpec,
  AddNodeSpec,
  ChangeGraphMetadataSpec,
} from "../../editor/types.js";

export type SnapshotEventMap = {
  stale: SnapshotStaleEvent;
  fresh: SnapshotFreshEvent;
};

export type SnapshotStaleEvent = Event;
export type SnapshotFreshEvent = Event;

export type SnapshotEventTarget = TypedEventTarget<SnapshotEventMap>;

export type InspectableSnapshot = TypedEventTargetType<SnapshotEventMap> & {
  current(): InspectableMainGraphSnapshot;
};

export type InspectableMainGraphSnapshot = {
  /**
   * Returns this graph's metadata, if exists
   */
  readonly metadata: GraphMetadata | undefined;
  /**
   * Returns all nodes in the graph.
   */
  readonly nodes: InspectableNodeSnapshot[];
  /**
   * Returns all edges of the graph.
   */
  readonly edges: InspectableEdgeSnapshot[];
  /**
   * Returns all kits in the graph.
   */
  readonly kits: InspectableKitSnapshot[];

  /**
   * Returns the subgraphs that are embedded in this graph or `undefined` if
   * this is already a subgraph
   */
  readonly graphs: Record<GraphIdentifier, InspectableGraphSnapshot>;

  /**
   * Returns the modules that are embedded in this graph.
   */
  readonly modules: Record<ModuleIdentifier, InspectableModuleSnapshot>;
  /**
   * Returns true if the graph represents an `ImperativeGraph` instance.
   * Imperative `InspectableGraph` will still show nodes and edges, but
   * it is just a fixed topology that represents how the graph is run.
   */
  readonly imperative: boolean;
  /**
   * Returns the name of the designated "main" module if this is an
   * `ImperativeGraph` instance and `undefined` if it is not yet set or
   * this is a `DeclarativeGraph` instance.
   */
  readonly main: string | undefined;
};

export type InspectableGraphSnapshot = {
  /**
   * Returns this graph's metadata, if exists.
   */
  readonly metadata: GraphMetadata;
  /**
   * Returns all nodes in the graph.
   */
  readonly nodes: InspectableNodeSnapshot[];
  /**
   * Returns all edges of the graph.
   */
  readonly edges: InspectableEdgeSnapshot[];
  /**
   * Returns the id of this graph. If this is a main graph,
   * the value will be "". Otherwise, it will be the id of this subgraph.
   */
  readonly graphId: GraphIdentifier;
};

export type InspectableKitSnapshot = {
  readonly descriptor: KitDescriptor;
  readonly nodeTypes: InspectableNodeTypeSnapshot[];
};

export type InspectableNodeSnapshot = {
  /**
   * The `NodeDescriptor` for the node.
   */
  readonly descriptor: NodeDescriptor;
  /**
   * The title of the node. Use this to get a consistent name for the node.
   * When the node has a title in the `NodeMetadata`, will be used.
   * Otherwise, the id of the node will be used.
   */
  readonly title: string;
  /**
   * The description of the node as found in `NodeMetadata`. If not found,
   * falls back to `title()`.
   */
  readonly description: string;
  /**
   * Returns the nodes that have an edge to this node.
   */
  readonly incoming: InspectableEdgeSnapshot[];
  /**
   * Returns the nodes that have an edge from this node.
   */
  readonly outgoing: InspectableEdgeSnapshot[];
  /**
   * Return true if the node is an entry node (labeled as such or
   * has no incoming edges)
   */
  readonly isEntry: boolean;
  /**
   * Return true if the node is an exit node (no outgoing edges)
   */
  readonly isExit: boolean;
  /**
   * Returns the `InspectableNodeType` instance for the node.
   */
  readonly type: InspectableNodeTypeSnapshot;

  /**
   * Returns configuration of the node.
   * TODO: Use a friendlier to inspection return type.
   */
  readonly configuration: NodeConfiguration;
  /**
   * Returns metadata for the node.
   */
  readonly metadata: NodeMetadata;
  /**
   * Returns the current state of node's ports
   */
  readonly ports: InspectableNodePortsSnapshot | undefined;
};

export type InspectableEdgeSnapshot = Edge & {
  /**
   * The type of the edge.
   */
  readonly type: "ordinary" | "constant" | "control" | "star";
};

export type InspectableModuleSnapshot = {
  /**
   * Returns the metadata, associated with this node type.
   */
  readonly metadata: ModuleMetadata;

  /**
   *
   */
  readonly code: ModuleCode;
};

export type InspectableNodeTypeSnapshot = {
  /**
   * Returns the metadata, associated with this node type.
   */
  readonly metadata: NodeHandlerMetadata | undefined;
  /**
   * Returns the type of the node.
   */
  readonly type: NodeTypeIdentifier;
  /**
   * Returns the ports of the node.
   */
  readonly ports: InspectableNodePortsSnapshot | undefined;
};

export type InspectableNodePortsSnapshot = {
  /**
   * Returns the input ports of the node.
   */
  readonly inputs: InspectablePortListSnapshot;
  /**
   * Returns the output ports of the node.
   */
  readonly outputs: InspectablePortListSnapshot;
  /**
   * Return the side ports of the node.
   */
  readonly side: InspectablePortListSnapshot;
};

export type InspectablePortListSnapshot = {
  readonly ports: InspectablePortSnapshot[];
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
  readonly fixed: boolean;
};

export type InspectablePortSnapshot = {
  /**
   * The name of the port.
   */
  readonly name: string;
  /**
   * The title of the port, if specified by schema. Otherwise, same as the
   * name of the port
   */
  readonly title: string;
  /**
   * Returns current status of this port.
   */
  readonly status: /**
   * The port status impossible to determine. This only happens when the node
   * has a star wire ("*") and the port is not connected.
   */
  | "indeterminate"
    /**
     * The port is correctly connected to another node or specified using node's
     * configuration, according to this node's schema.
     */
    | "connected"
    /**
     * The port is not connected to another node, and it is expected, but not
     * required by the node's schema.
     */
    | "ready"
    /**
     * The port is not connected to another node, but it is required by the node's
     * schema. It is similar to "Ready", except that not having this port
     * connected is an error.
     */
    | "missing"
    /**
     * The port is connected to this node, but it is not expected by the node's
     * schema. This is an error state.
     */
    | "dangling";
  /**
   * Returns true if the port was specified in the node's configuration.
   */
  readonly configured: boolean;
  /**
   * Returns current value for the port. This value is computed as follows:
   * - if there is a value coming from one of the incoming edges, then
   *   return that value;
   * - otherwise, if there is a value specified in node's configuration,
   *   then return that value;
   * - otherwise, return null;
   */
  readonly value: NodeValue;
  /**
   * Returns true if this is the star or control port ("*" or "").
   */
  readonly star: boolean;
  /**
   * Port schema as defined by the node's configuration.
   */
  readonly schema: Schema;
  /**
   * Returns the edges connected to this port.
   */
  // readonly edges: InspectableEdgeSnapshot[];

  /**
   * Is this an input, output, or side port?
   */
  readonly kind: SnapshotPortKind;
};

export type SnapshotPortKind = "input" | "output" | "side";

export type PortIdentifier = string;

export type SnapshotAddGraphSpec = {
  type: "addgraph";
  graphId: GraphIdentifier;
  timestamp: number;
  metadata?: GraphInlineMetadata;
  main?: string;
};

export type SnapshotAddEdgeSpec = AddEdgeSpec & {
  id: number;
  timestamp: number;
};

export type PortChanges = {
  fixedChanged: boolean;
  deleted: PortIdentifier[];
  added: InspectablePortSnapshot[];
  updated: InspectablePortSnapshot[];
};

export type NodePortChanges = {
  input: PortChanges;
  output: PortChanges;
  side: PortChanges;
};

export type SnapshotUpdatePortsSpec = {
  type: "updateports";
  timestamp: number;
  graphId: GraphIdentifier;
  nodeId: NodeIdentifier;
} & NodePortChanges;

export type SnapshotAddNodeSpec = AddNodeSpec & {
  timestamp: number;
};

export type SnapshotAddModuleSpec = AddModuleSpec & {
  timestamp: number;
};

export type SnapshotChangeGraphMetadataSpec = ChangeGraphMetadataSpec & {
  timestamp: number;
};

export type SnapshotChangeSpec =
  | SnapshotAddGraphSpec
  | SnapshotChangeGraphMetadataSpec
  | SnapshotAddNodeSpec
  | SnapshotAddEdgeSpec
  | SnapshotAddModuleSpec
  | SnapshotUpdatePortsSpec;

export type SnapshotPendingPortUpdate = Pick<
  SnapshotUpdatePortsSpec,
  "type" | "graphId" | "nodeId"
>;

export type SnapshotPendingUpdate = SnapshotPendingPortUpdate;
