/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";
import { InspectableGraph, InspectableGraphOptions } from "../index.js";
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
