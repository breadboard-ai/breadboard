/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  AssetPath,
  EdgeMetadata,
  GraphIdentifier,
  GraphMetadata,
  Module,
  ModuleIdentifier,
  NodeMetadata,
  NodeValue,
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
  visualOnly: boolean;
  changeType: ChangeEventType;
  affectedNodes: AffectedNode[];
  affectedGraphs: GraphIdentifier[];
  label: string | null;
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

export type ChangeEdgeMetadataSpec = {
  type: "changeedgemetadata";
  edge: EditableEdgeSpec;
  metadata: EdgeMetadata;
  graphId: GraphIdentifier;
  /**
   * If set to `true`, the metadata will be set to the value specified in
   * `metadata`. If set to `false`, the value will be merged with the
   * existing metadata. Defaults to `false`.
   */
  reset?: boolean;
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
  metadata?: GraphMetadata;
  title?: string;
  description?: string;
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

export type ToggleExportSpec = {
  type: "toggleexport";
  id: GraphIdentifier | ModuleIdentifier;
  exportType: "imperative" | "declarative";
};

export type AddAssetSpec = {
  type: "addasset";
  path: AssetPath;
  metadata?: AssetMetadata;
  data: NodeValue;
};

export type ChangeAssetMetadataSpec = {
  type: "changeassetmetadata";
  path: AssetPath;
  metadata: AssetMetadata;
};

export type RemoveAssetSpec = {
  type: "removeasset";
  path: AssetPath;
};

export type ReplaceGraphSpec = {
  type: "replacegraph";
  replacement: GraphDescriptor;
  creator: EditHistoryCreator;
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
  | ChangeEdgeMetadataSpec
  | ChangeConfigurationSpec
  | ChangeMetadataSpec
  | ChangeGraphMetadataSpec
  | ChangeModuleSpec
  | AddGraphSpec
  | RemoveGraphSpec
  | ToggleExportSpec
  | AddAssetSpec
  | RemoveAssetSpec
  | ChangeAssetMetadataSpec
  | ReplaceGraphSpec;

export type EditableGraph = {
  addEventListener<Key extends keyof EditableGraphEventMap>(
    eventName: Key,
    listener: ((evt: EditableGraphEventMap[Key]) => void) | null,
    options?: { once?: boolean }
  ): void;

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
  onHistoryChanged?: (entries: readonly EditHistoryEntry[]) => void;
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
   * Jumps to the entry with the given index.
   */
  jump(index: number): void;

  /**
   * The pending history entry, if there is one. Changes are not committed to
   * the entries array immediately, so that they can be batched to reduce churn.
   *
   * This value should effectively be treated as the latest history entry, with
   * the caveat that it might change before it is committed.
   */
  readonly pending: EditHistoryEntry | undefined;

  /**
   * Returns a list of all committed entries in the history.
   */
  entries(): EditHistoryEntry[];

  /**
   * Current index in the history.
   */
  index(): number;

  revertTo(index: number): EditHistoryEntry;
};

export type EditHistoryEntry = {
  graph: GraphDescriptor;
  label: string;
  timestamp: number;
  creator: EditHistoryCreator;
};

export type EditHistoryCreator =
  | { role: "user" }
  | { role: "assistant" }
  | { role: "unknown" };

export type EditableGraphOptions = InspectableGraphOptions & {
  /**
   * The initial version of the graph
   */
  version?: number;
  creator?: EditHistoryCreator;
  history?: EditHistoryEntry[];
  onHistoryChanged?: (history: readonly EditHistoryEntry[]) => void;
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
