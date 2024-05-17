/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  GraphMetadata,
  NodeMetadata,
} from "@google-labs/breadboard-schema/graph.js";
import {
  InspectableGraph,
  InspectableGraphOptions,
} from "../inspector/types.js";
import {
  Edge,
  GraphDescriptor,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
} from "../types.js";

export type GraphChangeEvent = Event & {
  graph: GraphDescriptor;
  version: number;
  visualOnly: boolean;
};

export type ErrorRejection = {
  type: "error";
  error: string;
};

export type NoChangeRejection = {
  type: "nochange";
};

export type RejectionReason = ErrorRejection | NoChangeRejection;

export type GraphChangeRejectEvent = Event & {
  graph: GraphDescriptor;
  reason: RejectionReason;
};

export type EditableGraphEventMap = {
  graphchange: GraphChangeEvent;
  graphchangereject: GraphChangeRejectEvent;
};

export type AddNodeSpec = {
  type: "addnode";
  node: EditableNodeSpec;
};

export type RemoveNodeSpec = {
  type: "removenode";
  id: NodeIdentifier;
};

export type AddEdgeSpec = {
  type: "addedge";
  edge: EditableEdgeSpec;
  strict: boolean;
};

export type RemoveEdgeSpec = {
  type: "removeedge";
  edge: EditableEdgeSpec;
};

/**
 * Changes the edge from `from` to `to`, if it can be changed.
 * This operation does not change the identity of the edge, but rather
 * mutates the properties of the edge. This is not an `addEdge` combined
 * with a `removeEdge`, but rather a true mutation of the edge.
 */
export type ChangeEdgeSpec = {
  type: "changeedge";
  from: EditableEdgeSpec;
  to: EditableEdgeSpec;
};

export type ChangeConfigurationSpec = {
  type: "changeconfiguration";
  id: NodeIdentifier;
  configuration?: NodeConfiguration;
};

export type ChangeMetadataSpec = {
  type: "changemetadata";
  id: NodeIdentifier;
  metadata?: NodeMetadata;
};

export type ChangeGraphMetadataSpec = {
  type: "changegraphmetadata";
  metadata: GraphMetadata;
};

export type AddGraphSpec = {
  type: "addgraph";
  id: GraphIdentifier;
  graph: GraphDescriptor;
};

export type ReplaceGraphSpec = {
  type: "replacegraph";
  id: GraphIdentifier;
  graph: GraphDescriptor;
};

export type RemoveGraphSpec = {
  type: "removegraph";
  id: GraphIdentifier;
};

export type EditSpec =
  | AddNodeSpec
  | RemoveNodeSpec
  | AddEdgeSpec
  | RemoveEdgeSpec
  | ChangeEdgeSpec
  | ChangeConfigurationSpec
  | ChangeMetadataSpec
  | ChangeGraphMetadataSpec;
export type EditResult = EdgeEditResult;

export type EditableGraph = {
  addEventListener<Key extends keyof EditableGraphEventMap>(
    eventName: Key,
    listener: ((evt: EditableGraphEventMap[Key]) => void) | null
  ): void;
  /**
   * Returns the current version of the graph. This number increments with
   * every edit.
   * @throws when used on an embedded subgraph.
   */
  version(): number;

  /**
   * Returns parent graph, if any.
   * This value will be non-null only for graphs (subgraphs) that are embedded
   * within a graph.
   */
  parent(): EditableGraph | null;

  edit(edits: EditSpec[], dryRun?: boolean): Promise<EditResult>;

  /**
   * Retrieves a subgraph of this graph.
   * @param id -- id of the subgraph
   * @throws when used on an embedded subgraph.
   */
  getGraph(id: GraphIdentifier): EditableGraph | null;
  /**
   * If does not exist already, adds a subgraph with the specified id.
   * Fails (returns null) if the subgraph with this id already exists.
   * @param id - id of the new subgraph
   * @param graph - the subgraph to add
   * @returns - the `EditableGraph` instance of the subgraph
   * @throws when used on an embedded subgraph.
   */
  addGraph(id: GraphIdentifier, graph: GraphDescriptor): EditableGraph | null;
  /**
   * Replaces the subgraph with the specified id. Fails (returns null)
   * if the subgraph with this id does not already exist.
   * @param id - id of the subgraph being replaced
   * @param graph - the subgraph with which to replace the existing subgraph
   * @returns - the `EditableGraph` instance of the newly replaced subgraph.
   * @throws when used on an embedded subgraph.
   */
  replaceGraph(
    id: GraphIdentifier,
    graph: GraphDescriptor
  ): EditableGraph | null;
  /**
   * Removes the subgraph with the specified id. Fails if the subgraph does not
   * exist.
   * @param id - id of the subgraph to remove
   * @throws when used on an embedded subgraph.
   */
  removeGraph(id: GraphIdentifier): SingleEditResult;

  raw(): GraphDescriptor;

  inspect(): InspectableGraph;
};

export type EditableGraphOptions = InspectableGraphOptions & {
  /**
   * The initial version of the graph
   */
  version?: number;
};

export type EditableNodeSpec = NodeDescriptor;

export type SingleEditResult =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
    };

export type EdgeEditResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
      alternative?: EditableEdgeSpec;
    };

export type EditableEdgeSpec = Edge;
