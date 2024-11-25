/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphIdentifier, NodeIdentifier } from "../types.js";
import {
  SingleEditResult,
  EditableGraph,
  EditableGraphOptions,
  RejectionReason,
  EditSpec,
  EditResult,
  EditOperation,
  EditOperationContext,
  EditResultLogEntry,
  EditHistory,
  EditTransform,
  EditTransformResult,
  EditOperationConductor,
  AffectedNode,
} from "./types.js";
import { ChangeEvent, ChangeRejectEvent } from "./events.js";
import { AddEdge } from "./operations/add-edge.js";
import { AddNode } from "./operations/add-node.js";
import { AddModule } from "./operations/add-module.js";
import { RemoveNode } from "./operations/remove-node.js";
import { RemoveEdge } from "./operations/remove-edge.js";
import { RemoveModule } from "./operations/remove-module.js";
import { ChangeEdge } from "./operations/change-edge.js";
import { ChangeConfiguration } from "./operations/change-configuration.js";
import { ChangeMetadata } from "./operations/change-metadata.js";
import { ChangeGraphMetadata } from "./operations/change-graph-metadata.js";
import { ChangeModule } from "./operations/change-module.js";
import { GraphEditHistory } from "./history.js";
import { ModuleIdentifier } from "@breadboard-ai/types";
import {
  isImperativeGraph,
  toDeclarativeGraph,
  toImperativeGraph,
} from "../run/run-imperative-graph.js";
import { AddGraph } from "./operations/add-graph.js";
import { RemoveGraph } from "./operations/remove-graph.js";
import { MutableGraphImpl } from "../inspector/graph/mutable-graph.js";
import { MutableGraph } from "../inspector/types.js";

const validImperativeEdits: EditSpec["type"][] = [
  "addmodule",
  "changegraphmetadata",
  "removemodule",
  "changemodule",
];

const operations = new Map<EditSpec["type"], EditOperation>([
  ["addnode", new AddNode()],
  ["removenode", new RemoveNode()],
  ["addedge", new AddEdge()],
  ["removeedge", new RemoveEdge()],
  ["changeedge", new ChangeEdge()],
  ["changeconfiguration", new ChangeConfiguration()],
  ["changemetadata", new ChangeMetadata()],
  ["changegraphmetadata", new ChangeGraphMetadata()],
  ["addmodule", new AddModule()],
  ["removemodule", new RemoveModule()],
  ["changemodule", new ChangeModule()],
  ["addgraph", new AddGraph()],
  ["removegraph", new RemoveGraph()],
]);

export class Graph implements EditableGraph {
  #version = 0;
  #mutable: MutableGraphImpl;
  #graph: GraphDescriptor;
  #eventTarget: EventTarget = new EventTarget();
  #history: GraphEditHistory;
  #imperativeMain: string | null = null;

  constructor(mutable: MutableGraph, options: EditableGraphOptions) {
    const graph = mutable.graph;
    if (isImperativeGraph(graph)) {
      this.#imperativeMain = graph.main;
      this.#graph = toDeclarativeGraph(graph);
    } else {
      this.#graph = graph;
    }
    this.#mutable = mutable;
    this.#version = options.version || 0;
    this.#history = new GraphEditHistory({
      graph: () => {
        return this.raw();
      },
      version: () => {
        return this.#version;
      },
      setGraph: (graph) => {
        this.#graph = graph;
        this.#version++;
        this.#mutable.rebuild(graph);
        this.#eventTarget.dispatchEvent(
          new ChangeEvent(this.raw(), this.#version, false, "history", [], [])
        );
      },
    });
    this.#history.add(this.raw(), "Clean slate");
  }

  #updateGraph(
    visualOnly: boolean,
    affectedNodes: AffectedNode[],
    affectedModules: ModuleIdentifier[]
  ) {
    this.#version++;
    this.#mutable.update(
      this.#graph,
      visualOnly,
      affectedNodes,
      affectedModules
    );
    this.#eventTarget.dispatchEvent(
      new ChangeEvent(
        this.#graph,
        this.#version,
        visualOnly,
        "edit",
        affectedNodes,
        affectedModules
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

  addEventListener(eventName: string, listener: EventListener): void {
    this.#eventTarget.addEventListener(eventName, listener);
  }

  version() {
    return this.#version;
  }

  #shouldDiscardEdit(edit: EditSpec) {
    if (this.#imperativeMain) {
      return !validImperativeEdits.includes(edit.type);
    }
    return false;
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

  async edit(
    edits: EditSpec[],
    label: string,
    dryRun = false
  ): Promise<EditResult> {
    return this.#applyEdits(async (context) => {
      await context.apply(edits, label);
      return {
        success: true,
        spec: { edits, label },
      };
    }, dryRun);
  }

  async apply(transform: EditTransform, dryRun = false): Promise<EditResult> {
    return this.#applyEdits((context) => {
      return transform.apply(context);
    }, dryRun);
  }

  history(): EditHistory {
    return this.#history;
  }

  raw() {
    return this.#imperativeMain
      ? toImperativeGraph(this.#imperativeMain, this.#graph)
      : this.#graph;
  }

  inspect(id: GraphIdentifier) {
    const inspectableGraph = this.#mutable.graphs.get(id || "");
    if (!inspectableGraph) {
      throw new Error(`Unknown sub-graph id: "${id}"`);
    }
    return inspectableGraph;
  }

  async #applyEdits(
    transformer: (
      context: EditOperationContext
    ) => Promise<EditTransformResult>,
    dryRun = false
  ): Promise<EditResult> {
    const checkpoint = structuredClone(this.#graph);
    const log: EditResultLogEntry[] = [];
    let label = "";

    let error: string | null = null;
    // Presume that all edits will result in no changes.
    let noChange = true;
    // Presume that all edits will be visual only.
    let visualOnly = true;
    // Collect affected nodes
    const affectedNodes: AffectedNode[][] = [];
    // Collect affected modules
    const affectedModules: NodeIdentifier[][] = [];
    let context: EditOperationContext;
    const apply: EditOperationConductor = async (
      edits: EditSpec[],
      editLabel: string
    ) => {
      if (error) return { success: false, error };
      label = editLabel;
      for (const edit of edits) {
        if (this.#shouldDiscardEdit(edit)) {
          continue;
        }
        const result = await this.#singleEdit(edit, context);
        log.push({ edit: edit.type, result });
        if (!result.success) {
          error = result.error;
          return { success: false, error };
        }
        affectedNodes.push(result.affectedNodes);
        affectedModules.push(result.affectedModules);
        if (!result.noChange) {
          noChange = false;
        }
        if (!result.visualOnly) {
          visualOnly = false;
        }
      }
      return { success: true, result: undefined };
    };

    if (dryRun) {
      const graph = checkpoint;
      const mutable = new MutableGraphImpl(graph, this.#mutable.options);
      context = {
        graph,
        mutable,
        apply,
      };
    } else {
      context = {
        graph: this.#graph,
        mutable: this.#mutable,
        apply,
      };
    }
    const result = await transformer(context);
    if (!result.success) {
      error = result.error;
    }
    if (error) {
      !dryRun && this.#rollbackGraph(checkpoint, error);
      return { success: false, log, error };
    }

    if (noChange) {
      !dryRun && this.#dispatchNoChange();
      return { success: true, log };
    }

    this.#history.addEdit(this.raw(), checkpoint, label, this.#version);

    !dryRun &&
      this.#updateGraph(
        visualOnly,
        [...new Set(affectedNodes.flat())],
        [...new Set(affectedModules.flat())]
      );
    return { success: true, log };
  }
}
