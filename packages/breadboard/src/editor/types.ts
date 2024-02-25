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

export type GraphEditReceiver = {
  onEdit(graph: GraphDescriptor, edits: AnyEdit[]): void;
};

export type AnyEdit =
  | AddNodeEdit
  | RemoveNodeEdit
  | AddEdgeEdit
  | RemoveEdgeEdit
  | ChangeConfigurationEdit
  | ChangeMetadataEdit;

export type AddNodeEdit = {
  type: "addNode";
  node: EditableNodeSpec;
};

export type RemoveNodeEdit = {
  type: "removeNode";
  id: NodeIdentifier;
};

export type AddEdgeEdit = {
  type: "addEdge";
  edge: EditableEdgeSpec;
};

export type RemoveEdgeEdit = {
  type: "removeEdge";
  edge: EditableEdgeSpec;
};

export type ChangeConfigurationEdit = {
  type: "changeConfiguration";
  id: NodeIdentifier;
  configuration: NodeConfiguration;
};

export type ChangeMetadataEdit = {
  type: "changeMetadata";
  id: NodeIdentifier;
  metadata: NodeMetadata;
};
