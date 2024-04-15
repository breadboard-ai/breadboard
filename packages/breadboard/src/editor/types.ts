/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
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

  canAddNode(spec: EditableNodeSpec): Promise<EditResult>;
  addNode(spec: EditableNodeSpec): Promise<EditResult>;

  canRemoveNode(id: NodeIdentifier): Promise<EditResult>;
  removeNode(id: NodeIdentifier): Promise<EditResult>;

  canAddEdge(spec: EditableEdgeSpec): Promise<EdgeEditResult>;
  addEdge(spec: EditableEdgeSpec, strict?: boolean): Promise<EdgeEditResult>;

  canRemoveEdge(spec: EditableEdgeSpec): Promise<EditResult>;
  removeEdge(spec: EditableEdgeSpec): Promise<EditResult>;

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
  removeGraph(id: GraphIdentifier): EditResult;

  /**
   * Returns whether the edge can be changed from `from` to `to`.
   *  @param from -- the edge spec to change from
   * @param to  -- the edge spec to change to
   */
  canChangeEdge(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec,
    strict?: boolean
  ): Promise<EdgeEditResult>;
  /**
   * Changes the edge from `from` to `to`, if it can be changed.
   * This operation does not change the identity of the edge, but rather
   * mutates the properties of the edge. This is not an `addEdge` combined
   * with a `removeEdge`, but rather a true mutation of the edge.
   * @param from -- the edge spec to change from
   * @param to  -- the edge spec to change to
   */
  changeEdge(from: EditableEdgeSpec, to: EditableEdgeSpec): Promise<EditResult>;

  canChangeConfiguration(id: NodeIdentifier): Promise<EditResult>;
  changeConfiguration(
    id: NodeIdentifier,
    configuration: NodeConfiguration
  ): Promise<EditResult>;

  canChangeMetadata(id: NodeIdentifier): Promise<EditResult>;
  changeMetadata(
    id: NodeIdentifier,
    metadata: NodeMetadata
  ): Promise<EditResult>;

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

export type EditResult =
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
