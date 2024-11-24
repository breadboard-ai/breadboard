/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  GraphMetadata,
  Module,
  ModuleIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import {
  InspectableGraph,
  InspectableGraphOptions,
  MutableGraph,
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
  affectedNodes: AffectedNode[];
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
  graphId: GraphIdentifier;
};

export type AddModuleSpec = {
  type: "addmodule";
  id: ModuleIdentifier;
  module: Module;
};

export type RemoveNodeSpec = {
  type: "removenode";
  id: NodeIdentifier;
  graphId: GraphIdentifier;
};

export type RemoveModuleSpec = {
  type: "removemodule";
  id: ModuleIdentifier;
};

export type AddEdgeSpec = {
  type: "addedge";
  edge: EditableEdgeSpec;
  graphId: GraphIdentifier;
};

export type RemoveEdgeSpec = {
  type: "removeedge";
  edge: EditableEdgeSpec;
  graphId: GraphIdentifier;
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
  graphId: GraphIdentifier;
};

export type ChangeConfigurationSpec = {
  type: "changeconfiguration";
  id: NodeIdentifier;
  configuration: NodeConfiguration;
  graphId: GraphIdentifier;
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
  graphId: GraphIdentifier;
  /**
   * If set to `true`, the metadata will be set to the value specified in
   * `metadata`. If set to `false`, the value will be merged with the
   * existing metadata. Defaults to `false`.
   */
  reset?: boolean;
};

export type ChangeModuleSpec = {
  type: "changemodule";
  id: ModuleIdentifier;
  module: Module;
};

export type ChangeGraphMetadataSpec = {
  type: "changegraphmetadata";
  metadata: GraphMetadata;
  graphId: GraphIdentifier;
};

export type AddGraphSpec = {
  type: "addgraph";
  id: GraphIdentifier;
  graph: GraphDescriptor;
};

export type RemoveGraphSpec = {
  type: "removegraph";
  id: GraphIdentifier;
};

export type EditOperationConductor = (
  edits: EditSpec[],
  editLabel: string
) => Promise<Result<undefined>>;

export type EditOperationContext = {
  graph: GraphDescriptor;
  mutable: MutableGraph;
  apply: EditOperationConductor;
};

export type EditOperation = {
  do(edit: EditSpec, context: EditOperationContext): Promise<SingleEditResult>;
};

export type EditSpec =
  | AddModuleSpec
  | AddNodeSpec
  | RemoveNodeSpec
  | AddEdgeSpec
  | RemoveEdgeSpec
  | RemoveModuleSpec
  | ChangeEdgeSpec
  | ChangeConfigurationSpec
  | ChangeMetadataSpec
  | ChangeGraphMetadataSpec
  | ChangeModuleSpec
  | AddGraphSpec
  | RemoveGraphSpec;

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
   * Performs an edit operation on the graph.
   * @param edits -- a list of changes to apply
   * @param label -- a user-friendly description of the edit, which also
   * serves a grouping hint for undo/redo operations.
   * @param dryRun -- if true, perform the edit, but discard the changes.
   */
  edit(edits: EditSpec[], label: string, dryRun?: boolean): Promise<EditResult>;

  /**
   * Applies an edit transform to the graph.
   * @param transform -- the edit transform to apply
   */
  apply(transform: EditTransform): Promise<EditResult>;

  /**
   * Provides a way to manage the history of the graph.
   */
  history(): EditHistory;

  raw(): GraphDescriptor;

  inspect(id: GraphIdentifier | null): InspectableGraph;
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
      affectedNodes: AffectedNode[];
      affectedModules: ModuleIdentifier[];
      affectedGraphs: GraphIdentifier[];
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

export type AffectedNode = {
  id: NodeIdentifier;
  graphId: GraphIdentifier;
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

export type EditTransform = {
  apply(context: EditOperationContext): Promise<EditTransformResult>;
};

export type EditTransformResult =
  | { success: false; error: string }
  | { success: true };

export type EditableGraphSelectionResult =
  | ({
      success: true;
    } & EditableGraphSelection)
  | { success: false; error: string };

export type EditableGraphSelection = {
  nodes: NodeIdentifier[];
  edges: Edge[];
  dangling: Edge[];
};

export type Result<R> =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
      result: R;
    };
