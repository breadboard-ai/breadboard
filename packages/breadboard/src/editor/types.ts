/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

  canChangeConfiguration(id: NodeIdentifier): Promise<EditResult>;
  changeConfiguration(
    id: NodeIdentifier,
    configuration: NodeConfiguration
  ): Promise<EditResult>;

  raw(): GraphDescriptor;

  inspect(): InspectableGraph;
};

export type EditableGraphOptions = InspectableGraphOptions;

export type EditableNodeSpec = NodeDescriptor;

export type EditResult = {
  success: boolean;
  error?: string;
};

export type EditableEdgeSpec = Edge;
