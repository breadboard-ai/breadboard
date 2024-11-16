/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inspectableGraph } from "../inspector/graph.js";
import { InspectableGraphWithStore } from "../inspector/types.js";
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
]);

export class Graph implements EditableGraph {
  #version = 0;
  #options: EditableGraphOptions;
  #inspector: InspectableGraphWithStore;
  #graph: GraphDescriptor;
  #graphId: GraphIdentifier;
  #parent: Graph | null;
  #graphs: Map<GraphIdentifier, Graph> | null;
  #eventTarget: EventTarget = new EventTarget();
  #history: GraphEditHistory;
  #imperativeMain: string | null = null;

  constructor(
    graph: GraphDescriptor,
    options: EditableGraphOptions,
    graphId: GraphIdentifier,
    parent: Graph | null
  ) {
    if (isImperativeGraph(graph)) {
      this.#imperativeMain = graph.main;
      this.#graph = toDeclarativeGraph(graph);
    } else {
      this.#graph = graph;
    }
    this.#parent = parent || null;
    if (parent) {
      // Subgraphs can not have subgraphs.
      this.#graphs = null;
      const inspector = parent.inspect().graphs()?.[graphId];
      if (!inspector) {
        throw new Error(
          `Inspect API integrity error: Unable to find subgraph "${graphId}`
        );
      }
      this.#inspector = inspector as InspectableGraphWithStore;
    } else {
      this.#inspector = inspectableGraph(this.raw(), options);
      this.#graphs = new Map(
        Object.entries(this.#graph.graphs || {}).map(([id, graph]) => [
          id,
          new Graph(graph, options, id, this),
        ])
      );
    }
    this.#graphId = graphId;
    this.#options = options;
    this.#version = parent ? 0 : options.version || 0;
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
        this.#inspector.resetGraph(graph);
        this.#eventTarget.dispatchEvent(
          new ChangeEvent(this.raw(), this.#version, false, "history", [], [])
        );
      },
    });
    this.#history.add(this.raw(), "Clean slate");
  }

  #makeIndependent() {
    this.#parent = null;
    this.#graphs = new Map();
  }

  #updateGraph(
    visualOnly: boolean,
    affectedNodes: NodeIdentifier[],
    affectedModules: ModuleIdentifier[]
  ) {
    if (this.#parent) {
      this.#graph = { ...this.#graph };
      // Update parent version.
      this.#parent.#updateGraph(visualOnly, [], []);
    } else {
      // if (!this.#graphs) {
      //   throw new Error(
      //     "Integrity error: a supergraph with no ability to add subgraphs"
      //   );
      // }
      // const entries = Object.entries(this.#graphs);
      // if (entries.length === 0) {
      //   if ("graphs" in this.#graph) delete this.#graph["graphs"];
      //   this.#graph = { ...this.#graph };
      // } else {
      //   const graphs = Object.fromEntries(
      //     entries.map(([id, graph]) => [id, graph.raw()])
      //   );
      //   this.#graph = { ...this.#graph, graphs };
      // }
      this.#version++;
    }
    this.#inspector.updateGraph(
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
    // TODO: Handle subgraphs.
    this.#inspector.resetGraph(this.#graph);
    this.#dispatchNoChange(error);
  }

  #dispatchNoChange(error?: string) {
    if (this.#parent) {
      this.#parent.#dispatchNoChange(error);
    }
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
    if (this.#parent) {
      throw new Error("Subgraphs can not be versioned.");
    }
    return this.#version;
  }

  parent() {
    return this.#parent;
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
    let context: EditOperationContext;

    const checkpoint = structuredClone(this.#graph);
    if (dryRun) {
      const graph = checkpoint;
      const inspector = inspectableGraph(graph, this.#options);
      context = {
        graph,
        inspector,
        store: inspector,
      };
    } else {
      context = {
        graph: this.#graph,
        inspector: this.#inspector,
        store: this.#inspector,
      };
    }
    const log: EditResultLogEntry[] = [];
    let error: string | null = null;
    // Presume that all edits will result in no changes.
    let noChange = true;
    // Presume that all edits will be visual only.
    let visualOnly = true;
    // Collect affected nodes
    const affectedNodes: NodeIdentifier[][] = [];
    // Collect affected modules
    const affectedModules: NodeIdentifier[][] = [];
    for (const edit of edits) {
      if (this.#shouldDiscardEdit(edit)) {
        continue;
      }
      const result = await this.#singleEdit(edit, context);
      log.push({ edit: edit.type, result });
      if (!result.success) {
        error = result.error;
        break;
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

  history(): EditHistory {
    return this.#history;
  }

  getGraph(id: GraphIdentifier) {
    if (!this.#graphs) {
      throw new Error("Subgraphs can't contain subgraphs.");
    }

    let editableGraph = this.#graphs.get(id);
    if (editableGraph) {
      return editableGraph;
    }

    const graph = this.raw().graphs?.[id];
    if (!graph) {
      return null;
    }

    editableGraph = new Graph(graph, this.#options, id, this);
    this.#graphs.set(id, editableGraph);
    return editableGraph;
  }

  addGraph(id: GraphIdentifier, graph: GraphDescriptor): boolean {
    if (!this.#graphs) {
      throw new Error("Subgraphs can't contain subgraphs.");
    }

    const subGraphs = this.#graph.graphs;
    if (subGraphs?.[id]) {
      return false;
    }

    this.#graph.graphs ??= {};
    this.#graph.graphs[id] = graph;
    this.#updateGraph(false, [], []);
    return true;
  }

  graphId() {
    return this.#graphId;
  }

  removeGraph(id: GraphIdentifier): SingleEditResult {
    if (!this.#graphs) {
      throw new Error("Subgraphs can't contain subgraphs.");
    }

    const subGraphs = this.#graph.graphs;

    if (!subGraphs || !subGraphs[id]) {
      const error = `Subgraph with id "${id}" does not exist`;
      this.#dispatchNoChange(error);
      return {
        success: false,
        error,
      };
    }
    delete subGraphs[id];
    if (!Object.keys(subGraphs).length) {
      delete this.#graph.graphs;
    }
    const editableToDelete = this.#graphs.get(id);
    if (editableToDelete) {
      this.#graphs.delete(id);
      editableToDelete.#makeIndependent();
    }
    this.#updateGraph(false, [], []);
    return { success: true, affectedNodes: [], affectedModules: [] };
  }

  replaceGraph(id: GraphIdentifier, graph: GraphDescriptor): boolean {
    if (!this.#graphs) {
      throw new Error("Subgraphs can't contain subgraphs.");
    }

    const subGraphs = this.#graph.graphs;

    if (!subGraphs) {
      return false;
    }

    const old = subGraphs[id];
    if (!old) {
      return false;
    } else {
      const oldEditable = this.#graphs.get(id);
      if (oldEditable) {
        oldEditable.#makeIndependent();
        this.#graphs.delete(id);
      }
    }
    subGraphs[id] = graph;

    this.#updateGraph(false, [], []);

    return true;
  }

  raw() {
    return this.#imperativeMain
      ? toImperativeGraph(this.#imperativeMain, this.#graph)
      : this.#graph;
  }

  inspect() {
    return this.#inspector;
  }
}
