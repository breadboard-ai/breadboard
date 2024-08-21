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
  GraphStoreMutator,
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

export type ChangeEventType = "edit" | "history";

export type GraphChangeEvent = Event & {
  graph: GraphDescriptor;
  version: number;
  visualOnly: boolean;
  changeType: ChangeEventType;
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
  configuration: NodeConfiguration;
  /**
   * If set to `true`, the configuration will be set to the value specified in
   * `configuration`. If set to `false`, the value will be merged with the
   * existing configuration. Defaults to `false`.
   */
  reset?: boolean;
};

export type ChangeMetadataSpec = {
  type: "changemetadata";
  id: NodeIdentifier;
  metadata: NodeMetadata;
  /**
   * If set to `true`, the metadata will be set to the value specified in
   * `metadata`. If set to `false`, the value will be merged with the
   * existing metadata. Defaults to `false`.
   */
  reset?: boolean;
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

export type EditOperationContext = {
  graph: GraphDescriptor;
  inspector: InspectableGraph;
  store: GraphStoreMutator;
};

export type EditOperation = {
  do(edit: EditSpec, context: EditOperationContext): Promise<SingleEditResult>;
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

  /**
   * Performs an edit operation on the graph.
   * @param edits -- a list of changes to apply
   * @param label -- a user-friendly description of the edit, which also
   * serves a grouping hint for undo/redo operations.
   * @param dryRun -- if true, perform the edit, but discard the changes.
   */
  edit(edits: EditSpec[], label: string, dryRun?: boolean): Promise<EditResult>;

  /**
   * Provides a way to manage the history of the graph.
   */
  history(): EditHistory;

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

export type EditHistoryController = {
  graph(): GraphDescriptor;
  setGraph(graph: GraphDescriptor): void;
  version(): number;
};

export type EditHistory = {
  /**
   * Reports whether an undo operation is possible at a given moment.
   * The undo may not be possible because we're at the beginning of the
   * history. */
  canUndo(): boolean;

  /**
   * Reports whether a redo operation is possible at a given moment.
   * The redo may not be possible because we're at the end of the history.
   */
  canRedo(): boolean;

  /**
   * Undoes the last change or does nothing if there isn't one.
   */
  undo(): void;

  /**
   * Re-does the change that was undone or does nothing if there isn't one.
   */
  redo(): void;

  /**
   * Returns a list of all entries in the history.
   */
  entries(): EditHistoryEntry[];

  /**
   * Current index in the history.
   */
  index(): number;
};

export type EditHistoryEntry = { graph: GraphDescriptor; label: string };

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
      /**
       * Only used when editing edges, provides an
       * alternative that could be used for the operation to still succeed.
       */
      alternative?: EditableEdgeSpec;
    }
  | {
      success: true;
      /**
       * Indicates that the edit was successful, and
       * resulted in no change.
       */
      noChange?: boolean;
      /**
       * Indicates that this edit only involved visual
       * changes.
       */
      visualOnly?: boolean;
    };

export type EditResultLogEntry = {
  edit: EditSpec["type"];
  result: SingleEditResult;
};

/**
 * Multi-edit result.
 */
export type EditResult = {
  log: EditResultLogEntry[];
} & (
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    }
);

export type EditableEdgeSpec = Edge;
