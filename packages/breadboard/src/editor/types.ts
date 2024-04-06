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

export type EditableGraph = {
  canAddNode(spec: EditableNodeSpec): Promise<EditResult>;
  addNode(spec: EditableNodeSpec): Promise<EditResult>;

  canRemoveNode(id: NodeIdentifier): Promise<EditResult>;
  removeNode(id: NodeIdentifier): Promise<EditResult>;

  canAddEdge(spec: EditableEdgeSpec): Promise<EditResult>;
  addEdge(spec: EditableEdgeSpec): Promise<EditResult>;

  canRemoveEdge(spec: EditableEdgeSpec): Promise<EditResult>;
  removeEdge(spec: EditableEdgeSpec): Promise<EditResult>;

  /**
   * Retrieves a subgraph of this graph.
   * @param id -- id of the subgraph
   */
  getGraph(id: GraphIdentifier): EditableGraph | null;
  /**
   * If does not exist already, adds a subgraph with the specified id. Fails if
   * the subgraph with this id already exists.
   * @param id - id of the new subgraph
   * @param graph - the subgraph to add
   */
  addGraph(id: GraphIdentifier, graph: EditableGraph): EditResult;
  /**
   * Replaces the subgraph with the specified id. Fails if the subgraph with
   * this id does not already exist.
   * @param id - id of the subgraph being replaced
   * @param graph - the subgraph with which to replace the existing subgraph
   */
  replaceGraph(id: GraphIdentifier, graph: EditableGraph): EditResult;
  /**
   * Removes the subgraph with the specified id. Fails if the subgraph does not
   * exist.
   * @param id - id of the subgraph to remove
   */
  removeGraph(id: GraphIdentifier): EditResult;

  /**
   * Returns whether the edge can be changed from `from` to `to`.
   *  @param from -- the edge spec to change from
   * @param to  -- the edge spec to change to
   */
  canChangeEdge(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec
  ): Promise<EditResult>;
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

export type EditableGraphOptions = InspectableGraphOptions;

export type EditableNodeSpec = NodeDescriptor;

export type EditResult =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
    };

export type EditableEdgeSpec = Edge;
