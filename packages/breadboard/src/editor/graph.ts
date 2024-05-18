/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inspectableGraph } from "../inspector/graph.js";
import { InspectableGraphWithStore } from "../inspector/types.js";
import { GraphDescriptor, GraphIdentifier } from "../types.js";
import {
  EdgeEditResult,
  SingleEditResult,
  EditableGraph,
  EditableGraphOptions,
  RejectionReason,
  EditSpec,
  EditResult,
  EditOperation,
} from "./types.js";
import { ChangeEvent, ChangeRejectEvent } from "./events.js";
import { AddEdge } from "./operations/add-edge.js";
import { AddNode } from "./operations/add-node.js";
import { RemoveNode } from "./operations/remove-node.js";
import { RemoveEdge } from "./operations/remove-edge.js";
import { ChangeEdge } from "./operations/change-edge.js";
import { ChangeConfiguration } from "./operations/change-configuration.js";
import { ChangeMetadata } from "./operations/change-metadata.js";
import { ChangeGraphMetadata } from "./operations/change-graph-metadata.js";

const operations = new Map<EditSpec["type"], EditOperation>([
  ["addnode", new AddNode()],
  ["removenode", new RemoveNode()],
  ["addedge", new AddEdge()],
  ["removeedge", new RemoveEdge()],
  ["changeedge", new ChangeEdge()],
  ["changeconfiguration", new ChangeConfiguration()],
  ["changemetadata", new ChangeMetadata()],
  ["changegraphmetadata", new ChangeGraphMetadata()],
]);

export class Graph implements EditableGraph {
  #version = 0;
  #options: EditableGraphOptions;
  #inspector: InspectableGraphWithStore;
  #graph: GraphDescriptor;
  #parent: Graph | null;
  #graphs: Record<GraphIdentifier, Graph> | null;
  #eventTarget: EventTarget = new EventTarget();

  constructor(
    graph: GraphDescriptor,
    options: EditableGraphOptions,
    parent: Graph | null
  ) {
    this.#graph = graph;
    this.#parent = parent || null;
    if (parent) {
      // Embedded subgraphs can not have subgraphs.
      this.#graphs = null;
    } else {
      this.#graphs = Object.fromEntries(
        Object.entries(graph.graphs || {}).map(([id, graph]) => [
          id,
          new Graph(graph, options, this),
        ])
      );
    }
    this.#options = options;
    this.#version = parent ? 0 : options.version || 0;
    this.#inspector = inspectableGraph(this.#graph, options);
  }

  #makeIndependent() {
    this.#parent = null;
    this.#graphs = {};
  }

  #updateGraph(visualOnly: boolean) {
    if (this.#parent) {
      this.#graph = { ...this.#graph };
      // Update parent version.
      this.#parent.#updateGraph(visualOnly);
    } else {
      if (!this.#graphs) {
        throw new Error(
          "Integrity error: a supergraph with no ability to add subgraphs"
        );
      }
      const entries = Object.entries(this.#graphs);
      if (entries.length === 0) {
        if ("graphs" in this.#graph) delete this.#graph["graphs"];
        this.#graph = { ...this.#graph };
      } else {
        const graphs = Object.fromEntries(
          entries.map(([id, graph]) => [id, graph.raw()])
        );
        this.#graph = { ...this.#graph, graphs };
      }
      this.#version++;
    }
    this.#inspector.updateGraph(this.#graph);
    this.#eventTarget.dispatchEvent(
      new ChangeEvent(this.#graph, this.#version, visualOnly)
    );
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
    this.#eventTarget.dispatchEvent(new ChangeRejectEvent(this.#graph, reason));
  }

  addEventListener(eventName: string, listener: EventListener): void {
    this.#eventTarget.addEventListener(eventName, listener);
  }

  version() {
    if (this.#parent) {
      throw new Error("Embedded subgraphs can not be versioned.");
    }
    return this.#version;
  }

  parent() {
    return this.#parent;
  }

  async edit(edits: EditSpec[], dryRun = false): Promise<EditResult> {
    if (edits.length > 1) {
      throw new Error("Multi-edit is not yet implemented");
    }
    if (dryRun) {
      return this.#canEdit(edits);
    }
    const edit = edits[0];
    const operation = operations.get(edit.type);
    if (!operation) {
      return {
        success: false,
        error: "Unsupported edit type",
      };
    }
    const can = await operation.do(edit, {
      graph: this.#graph,
      inspector: this.#inspector,
      store: this.#inspector,
    });
    if (!can.success) {
      this.#dispatchNoChange(can.error);
      return can;
    }
    if (can.nochange) {
      this.#dispatchNoChange();
      return can;
    }
    this.#updateGraph(!!can.visualOnly);
    return can;
  }

  async #canEdit(edits: EditSpec[]): Promise<EdgeEditResult> {
    if (edits.length > 1) {
      throw new Error("Multi-edit is not yet implemented");
    }
    const edit = edits[0];
    switch (edit.type) {
      case "addnode": {
        const operation = new AddNode();
        return operation.can(edit.node, this.#inspector);
      }
      case "removenode": {
        const operation = new RemoveNode();
        return operation.can(edit.id, this.#inspector);
      }
      case "addedge": {
        const operation = new AddEdge();
        return operation.can(edit.edge, this.#inspector);
      }
      case "removeedge": {
        const operation = new RemoveEdge();
        return operation.can(edit.edge, this.#inspector);
      }
      case "changeconfiguration": {
        const operation = new ChangeConfiguration();
        return operation.can(edit.id, this.#inspector);
      }
      case "changemetadata": {
        const operation = new ChangeMetadata();
        return operation.can(edit.id, this.#inspector);
      }
      case "changeedge": {
        const operation = new ChangeEdge();
        return operation.can(edit.from, edit.to, this.#inspector);
      }
      case "changegraphmetadata":
        return { success: true };
      default: {
        return {
          success: false,
          error: "Unsupported edit type",
        };
      }
    }
  }

  getGraph(id: GraphIdentifier) {
    if (!this.#graphs) {
      throw new Error("Embedded graphs can't contain subgraphs.");
    }
    return this.#graphs[id] || null;
  }

  addGraph(id: GraphIdentifier, graph: GraphDescriptor): EditableGraph | null {
    if (!this.#graphs) {
      throw new Error("Embedded graphs can't contain subgraphs.");
    }

    if (this.#graphs[id]) {
      return null;
    }

    const editable = new Graph(graph, this.#options, this);
    this.#graphs[id] = editable;
    this.#updateGraph(false);

    return editable;
  }

  removeGraph(id: GraphIdentifier): SingleEditResult {
    if (!this.#graphs) {
      throw new Error("Embedded graphs can't contain subgraphs.");
    }

    if (!this.#graphs[id]) {
      const error = `Subgraph with id "${id}" does not exist`;
      this.#dispatchNoChange(error);
      return {
        success: false,
        error,
      };
    }
    delete this.#graphs[id];
    this.#updateGraph(false);
    return { success: true };
  }

  replaceGraph(
    id: GraphIdentifier,
    graph: GraphDescriptor
  ): EditableGraph | null {
    if (!this.#graphs) {
      throw new Error("Embedded graphs can't contain subgraphs.");
    }

    const old = this.#graphs[id];
    if (!old) {
      return null;
    }
    old.#makeIndependent();

    const editable = new Graph(graph, this.#options, this);
    this.#graphs[id] = editable;
    this.#updateGraph(false);

    return editable;
  }

  raw() {
    return this.#graph;
  }

  inspect() {
    return this.#inspector;
  }
}
