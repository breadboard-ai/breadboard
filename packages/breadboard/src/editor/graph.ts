/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fixUpStarEdge } from "../inspector/edge.js";
import { inspectableGraph } from "../inspector/graph.js";
import { InspectableGraphWithStore } from "../inspector/types.js";
import {
  GraphDescriptor,
  NodeConfiguration,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../types.js";
import {
  EditResult,
  EditableEdgeSpec,
  EditableGraph,
  EditableGraphOptions,
  EditableNodeSpec,
} from "./types.js";

export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  return new Graph(graph, options);
};

class Graph implements EditableGraph {
  #options: EditableGraphOptions;
  #inspector: InspectableGraphWithStore;
  #validTypes?: Set<string>;
  #graph: GraphDescriptor;

  constructor(graph: GraphDescriptor, options: EditableGraphOptions) {
    this.#graph = graph;
    this.#options = options;
    this.#inspector = inspectableGraph(this.#graph, {
      kits: this.#options.kits,
    });
  }

  #isValidType(type: NodeTypeIdentifier) {
    return (this.#validTypes ??= new Set(
      this.#inspector.kits().flatMap((kit) => {
        return kit.nodeTypes.map((type) => {
          return type.type();
        });
      })
    )).has(type);
  }

  #findEdgeIndex(spec: EditableEdgeSpec) {
    return this.#graph.edges.findIndex((edge) => {
      return (
        edge.from === spec.from &&
        edge.to === spec.to &&
        edge.out === spec.out &&
        edge.in === spec.in
      );
    });
  }

  #edgesEqual(a: EditableEdgeSpec, b: EditableEdgeSpec) {
    return (
      a.from === b.from && a.to === b.to && a.out === b.out && a.in === b.in
    );
  }

  async canAddNode(spec: EditableNodeSpec): Promise<EditResult> {
    const duplicate = !!this.#inspector.nodeById(spec.id);
    if (duplicate) {
      return {
        success: false,
        error: `Node with id "${spec.id}" already exists`,
      };
    }

    const validType = this.#isValidType(spec.type);
    if (!validType) {
      return {
        success: false,
        error: `Node type "${spec.type}" is not a known type`,
      };
    }

    return { success: true };
  }

  async addNode(spec: EditableNodeSpec): Promise<EditResult> {
    const can = await this.canAddNode(spec);
    if (!can.success) return can;

    this.#graph.nodes.push(spec);
    this.#inspector.nodeStore.add(spec);
    return { success: true };
  }

  async canRemoveNode(id: NodeIdentifier): Promise<EditResult> {
    const exists = !!this.#inspector.nodeById(id);
    if (!exists) {
      return {
        success: false,
        error: `Node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async removeNode(id: NodeIdentifier): Promise<EditResult> {
    const can = await this.canRemoveNode(id);
    if (!can.success) return can;

    // Remove any edges that are connected to the removed node.
    this.#graph.edges = this.#graph.edges.filter((edge) => {
      const shouldRemove = edge.from === id || edge.to === id;
      if (shouldRemove) {
        this.#inspector.edgeStore.remove(edge);
      }
      return !shouldRemove;
    });
    // Remove the node from the graph.
    this.#graph.nodes = this.#graph.nodes.filter((node) => node.id != id);
    this.#inspector.nodeStore.remove(id);
    return { success: true };
  }

  async canAddEdge(spec: EditableEdgeSpec): Promise<EditResult> {
    if (spec.out === "*" && !(spec.in === "" || spec.in === "*")) {
      return {
        success: false,
        error: `The "*" output port cannot be connected to a specific input port`,
      };
    }
    if ((spec.in === "*" || spec.in === "") && !(spec.out === "*")) {
      return {
        success: false,
        error: `A specific input port cannot be connected to a "*" output port`,
      };
    }
    const inspector = this.#inspector;
    if (inspector.hasEdge(spec)) {
      return {
        success: false,
        error: `Edge from "${spec.from}" to "${spec.to}" already exists`,
      };
    }
    const from = inspector.nodeById(spec.from);
    if (!from) {
      return {
        success: false,
        error: `Node with id "${spec.from}" does not exist, but is required as the "from" part of the edge`,
      };
    }
    const to = inspector.nodeById(spec.to);
    if (!to) {
      return {
        success: false,
        error: `Node with id "${spec.to}" does not exist, but is required as the "to" part of the edge`,
      };
    }
    const fromPorts = (await from.ports()).outputs;
    if (fromPorts.fixed) {
      const found = fromPorts.ports.find((port) => port.name === spec.out);
      if (!found) {
        return {
          success: false,
          error: `Node with id "${spec.from}" does not have an output port named "${spec.out}"`,
        };
      }
    }
    const toPorts = (await to.ports()).inputs;
    if (toPorts.fixed) {
      const found = toPorts.ports.find((port) => port.name === spec.in);
      if (!found) {
        return {
          success: false,
          error: `Node with id "${spec.to}" does not have an input port named "${spec.in}"`,
        };
      }
    }
    return { success: true };
  }

  async addEdge(spec: EditableEdgeSpec): Promise<EditResult> {
    const can = await this.canAddEdge(spec);
    if (!can.success) return can;
    spec = fixUpStarEdge(spec);
    this.#graph.edges.push(spec);
    this.#inspector.edgeStore.add(spec);
    return { success: true };
  }

  async canRemoveEdge(spec: EditableEdgeSpec): Promise<EditResult> {
    if (!this.#inspector.hasEdge(spec)) {
      return {
        success: false,
        error: `Edge from "${spec.from}:${spec.out}" to "${spec.to}:${spec.in}" does not exist`,
      };
    }
    return { success: true };
  }

  async removeEdge(spec: EditableEdgeSpec): Promise<EditResult> {
    const can = await this.canRemoveEdge(spec);
    if (!can.success) return can;
    spec = fixUpStarEdge(spec);
    const edges = this.#graph.edges;
    const index = this.#findEdgeIndex(spec);
    const edge = edges.splice(index, 1)[0];
    this.#inspector.edgeStore.remove(edge);
    return { success: true };
  }

  async canChangeEdge(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec
  ): Promise<EditResult> {
    if (this.#edgesEqual(from, to)) {
      return { success: true };
    }
    const canRemove = await this.canRemoveEdge(from);
    if (!canRemove.success) return canRemove;
    const canAdd = await this.canAddEdge(to);
    if (!canAdd.success) return canAdd;
    return { success: true };
  }

  async changeEdge(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec
  ): Promise<EditResult> {
    const can = await this.canChangeEdge(from, to);
    if (!can.success) return can;
    if (this.#edgesEqual(from, to)) {
      return { success: true };
    }
    const spec = fixUpStarEdge(from);
    const edges = this.#graph.edges;
    const index = this.#findEdgeIndex(spec);
    const edge = edges[index];
    edge.from = to.from;
    edge.out = to.out;
    edge.to = to.to;
    edge.in = to.in;
    return { success: true };
  }

  async canChangeConfiguration(id: NodeIdentifier): Promise<EditResult> {
    const node = this.#inspector.nodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async changeConfiguration(
    id: NodeIdentifier,
    configuration: NodeConfiguration
  ): Promise<EditResult> {
    const can = await this.canChangeConfiguration(id);
    if (!can.success) return can;
    const node = this.#inspector.nodeById(id);
    if (node) {
      node.descriptor.configuration = configuration;
    }
    return { success: true };
  }

  async canChangeMetadata(id: NodeIdentifier): Promise<EditResult> {
    const node = this.#inspector.nodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async changeMetadata(
    id: NodeIdentifier,
    metadata: NodeConfiguration
  ): Promise<EditResult> {
    const can = await this.canChangeMetadata(id);
    if (!can.success) return can;
    const node = this.#inspector.nodeById(id);
    if (node) {
      node.descriptor.metadata = metadata;
    }
    return { success: true };
  }

  raw() {
    return this.#graph;
  }

  inspect() {
    return this.#inspector;
  }
}
