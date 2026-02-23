/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AffectedNode,
  EditableGraph,
  EditableGraphOptions,
  EditHistory,
  EditHistoryCreator,
  EditOperation,
  EditOperationContext,
  EditResult,
  EditResultLogEntry,
  EditSpec,
  EditTransform,
  EditTransformResult,
  GraphDescriptor,
  GraphIdentifier,
  MutableGraph,
  RejectionReason,
  SingleEditResult,
} from "@breadboard-ai/types";
import { PromiseQueue } from "@breadboard-ai/utils";

import { ChangeEvent, ChangeRejectEvent } from "./events.js";
import { GraphEditHistory } from "./history.js";
import { AddAsset } from "./operations/add-asset.js";
import { AddEdge } from "./operations/add-edge.js";
import { AddGraph } from "./operations/add-graph.js";
import { AddNode } from "./operations/add-node.js";
import { ChangeAssetMetadata } from "./operations/change-asset-metadata.js";
import { ChangeConfiguration } from "./operations/change-configuration.js";
import { ChangeEdgeMetadata } from "./operations/change-edge-metadata.js";
import { ChangeEdge } from "./operations/change-edge.js";
import { ChangeGraphMetadata } from "./operations/change-graph-metadata.js";
import { ChangeMetadata } from "./operations/change-metadata.js";
import { RemoveAsset } from "./operations/remove-asset.js";
import { RemoveEdge } from "./operations/remove-edge.js";
import { RemoveGraph } from "./operations/remove-graph.js";
import { RemoveNode } from "./operations/remove-node.js";
import { ReplaceGraph } from "./operations/replace-graph.js";
import { ToggleExport } from "./operations/toggle-export.js";
import { UpsertInteration } from "./operations/upsert-integration.js";
import { RemoveIntegration } from "./operations/remove-integration.js";

const operations = new Map<EditSpec["type"], EditOperation>([
  ["addnode", new AddNode()],
  ["removenode", new RemoveNode()],
  ["addedge", new AddEdge()],
  ["removeedge", new RemoveEdge()],
  ["changeedge", new ChangeEdge()],
  ["changeedgemetadata", new ChangeEdgeMetadata()],
  ["changeconfiguration", new ChangeConfiguration()],
  ["changemetadata", new ChangeMetadata()],
  ["changegraphmetadata", new ChangeGraphMetadata()],
  ["addgraph", new AddGraph()],
  ["removegraph", new RemoveGraph()],
  ["toggleexport", new ToggleExport()],
  ["addasset", new AddAsset()],
  ["removeasset", new RemoveAsset()],
  ["changeassetmetadata", new ChangeAssetMetadata()],
  ["replacegraph", new ReplaceGraph()],
  ["upsertintegration", new UpsertInteration()],
  ["removeintegration", new RemoveIntegration()],
]);

export class Graph implements EditableGraph {
  #mutable: MutableGraph;
  #graph: GraphDescriptor;
  #eventTarget: EventTarget = new EventTarget();
  #history: GraphEditHistory;
  #edits: PromiseQueue<EditResult> = new PromiseQueue();

  constructor(mutable: MutableGraph, options: EditableGraphOptions) {
    this.#graph = mutable.graph;
    this.#mutable = mutable;
    this.#history = new GraphEditHistory({
      graph: () => {
        return this.raw();
      },
      setGraph: (graph) => {
        this.#graph = graph;
        this.#mutable.rebuild(graph);
        this.#eventTarget.dispatchEvent(
          new ChangeEvent(
            this.raw(),
            false,
            "history",
            [],
            [],
            true,
            true,
            null
          )
        );
      },
      onHistoryChanged: options.onHistoryChanged,
    });
    if (options.history?.length) {
      for (const revision of options.history) {
        this.#history.add(
          revision.graph,
          revision.label,
          revision.creator,
          revision.timestamp
        );
      }
    } else {
      this.#history.add(
        this.raw(),
        "Clean slate",
        options.creator ?? { role: "unknown" },
        Date.now()
      );
    }
  }

  #updateGraph(
    visualOnly: boolean,
    affectedNodes: AffectedNode[],
    affectedGraphs: GraphIdentifier[],
    topologyChange: boolean,
    integrationsChange: boolean,
    label: string
  ) {
    this.#mutable.update(this.#graph, visualOnly);
    this.#eventTarget.dispatchEvent(
      new ChangeEvent(
        this.#graph,
        visualOnly,
        "edit",
        affectedNodes,
        affectedGraphs,
        topologyChange,
        integrationsChange,
        label
      )
    );
  }

  #rollbackGraph(checkpoint: GraphDescriptor, error: string) {
    this.#graph = checkpoint;
    this.#mutable.rebuild(this.#graph);
    this.#dispatchNoChange(error);
  }

  #dispatchNoChange(error?: string) {
    this.#graph = { ...this.#graph };
    const reason: RejectionReason = error
      ? {
          type: "error",
          error,
        }
      : {
          type: "nochange",
        };
    this.#eventTarget.dispatchEvent(new ChangeRejectEvent(this.raw(), reason));
  }

  addEventListener(
    eventName: string,
    listener: EventListener,
    options?: { once?: boolean }
  ): void {
    this.#eventTarget.addEventListener(eventName, listener, options);
  }

  removeEventListener(eventName: string, listener: EventListener): void {
    this.#eventTarget.removeEventListener(eventName, listener);
  }

  async #singleEdit(
    edit: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    const operation = operations.get(edit.type);
    if (!operation) {
      return {
        success: false,
        error: "Unsupported edit type",
      };
    }
    return operation.do(edit, context);
  }

  async edit(edits: EditSpec[], label: string): Promise<EditResult> {
    return this.#edits.add(() =>
      this.#applyEdits(async (context) => {
        await context.apply(edits, label);
        return { success: true, spec: { edits, label } };
      })
    );
  }

  async apply(transform: EditTransform): Promise<EditResult> {
    return this.#edits.add(() =>
      this.#applyEdits((context) => transform.apply(context))
    );
  }

  history(): EditHistory {
    return this.#history;
  }

  raw() {
    return this.#graph;
  }

  inspect(id: GraphIdentifier) {
    const inspectableGraph = this.#mutable.graphs.get(id || "");
    if (!inspectableGraph) {
      throw new Error(`Unknown sub-graph id: "${id}"`);
    }
    return inspectableGraph;
  }

  async #applyEdits(
    transformer: (context: EditOperationContext) => Promise<EditTransformResult>
  ): Promise<EditResult> {
    const checkpoint = structuredClone(this.#graph);
    const log: EditResultLogEntry[] = [];
    let label = "";
    let creator: EditHistoryCreator = { role: "unknown" };

    let error: string | null = null;
    // Presume that all edits will result in no changes.
    let noChange = true;
    // Presume that all edits will be visual only.
    let visualOnly = true;
    // Collect affected nodes
    const affectedNodes: AffectedNode[][] = [];
    // Collect affected graphs
    const affectedGraphs: GraphIdentifier[][] = [];
    // Presume that there were no integration changes.
    let integrationsChange = false;
    // Presume that all edits will result in no topology change.
    let topologyChange = false;
    const context: EditOperationContext = {
      graph: this.#graph,
      mutable: this.#mutable,
      apply: async (edits: EditSpec[], editLabel: string) => {
        if (error) return { success: false, error };
        label = editLabel;
        for (const edit of edits) {
          const result = await this.#singleEdit(edit, context);
          log.push({ edit: edit.type, result });
          if (!result.success) {
            error = result.error;
            return { success: false, error };
          }
          affectedNodes.push(result.affectedNodes);
          affectedGraphs.push(result.affectedGraphs);
          if (!result.noChange) {
            noChange = false;
          }
          if (!result.visualOnly) {
            visualOnly = false;
          }
          if (result.topologyChange) {
            topologyChange = true;
          }
          if (result.integrationsChange) {
            integrationsChange = true;
          }
          if ("creator" in edit) {
            creator = edit.creator;
          }
        }
        return { success: true, result: undefined };
      },
    };

    const result = await transformer(context);
    if (!result.success) {
      error = result.error;
    }
    if (error) {
      this.#rollbackGraph(checkpoint, error);
      return { success: false, log, error };
    }

    if (noChange) {
      this.#dispatchNoChange();
      return { success: true, log };
    }

    this.#history.add(this.raw(), label, creator, Date.now());

    this.#updateGraph(
      visualOnly,
      unique(affectedNodes.flat()),
      [...new Set(affectedGraphs.flat())],
      topologyChange,
      integrationsChange,
      label
    );
    return { success: true, log };
  }
}

function unique(affectedNodes: AffectedNode[]): AffectedNode[] {
  const keys = new Set<string>();
  return affectedNodes.filter((affectedNode) => {
    const key = `${affectedNode.id}|${affectedNode.id}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}
