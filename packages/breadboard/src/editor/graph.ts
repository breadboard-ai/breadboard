/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { handlersFromKits } from "../handler.js";
import { inspectableGraph } from "../inspector/graph.js";
import { InspectableGraph } from "../inspector/types.js";
import { GraphDescriptor, NodeHandlers, NodeIdentifier } from "../types.js";
import {
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
  #nodes?: Map<NodeIdentifier, EditableNodeSpec>;
  #inspector?: InspectableGraph;
  #handlers?: NodeHandlers;
  #graph: GraphDescriptor;

  constructor(graph: GraphDescriptor, options: EditableGraphOptions) {
    this.#graph = graph;
    this.#options = options;
  }

  #getNodes() {
    return (this.#nodes ??= new Map(
      this.#graph.nodes.map((node) => [node.id, node])
    ));
  }

  #getHandlers() {
    return (this.#handlers ??= handlersFromKits(this.#options?.kits || []));
  }

  async canAddNode(spec: EditableNodeSpec) {
    const duplicate = this.#getNodes().has(spec.id);
    if (duplicate) {
      return {
        success: false,
        error: `Node with id "${spec.id}" already exists`,
      };
    }

    const validType = !!this.#getHandlers()[spec.type];
    if (!validType) {
      return {
        success: false,
        error: `Node type "${spec.type}" is not a known type`,
      };
    }

    return { success: true };
  }

  async addNode(spec: EditableNodeSpec) {
    const can = await this.canAddNode(spec);
    if (!can.success) return can;

    this.#graph.nodes.push(spec);
    return { success: true };
  }

  async canRemoveNode(id: NodeIdentifier) {
    const exists = this.#getNodes().has(id);
    if (!exists) {
      return {
        success: false,
        error: `Node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async removeNode(id: NodeIdentifier) {
    const can = await this.canRemoveNode(id);
    if (!can.success) return can;

    this.#graph.nodes = this.#graph.nodes.filter((node) => node.id != id);
    this.#nodes = undefined;
    return { success: true };
  }

  async canAddEdge(spec: EditableEdgeSpec) {
    const exists = !!this.#graph.edges.find((edge) => {
      return (
        edge.from === spec.from &&
        edge.to === spec.to &&
        edge.out === spec.out &&
        edge.in === spec.in
      );
    });
    if (exists) {
      return {
        success: false,
        error: `Edge from "${spec.from}" to "${spec.to}" already exists`,
      };
    }
    const inspector = this.inspect();
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

  async addEdge(spec: EditableEdgeSpec) {
    const can = await this.canAddEdge(spec);
    if (!can.success) return can;
    this.#graph.edges.push(spec);
    this.#inspector = undefined;
    return { success: true };
  }

  async canRemoveEdge(spec: EditableEdgeSpec) {
    const exists = !!this.#graph.edges.find((edge) => {
      return (
        edge.from === spec.from &&
        edge.to === spec.to &&
        edge.out === spec.out &&
        edge.in === spec.in
      );
    });
    if (!exists) {
      return {
        success: false,
        error: `Edge from "${spec.from}" to "${spec.to}" does not exist`,
      };
    }
    return { success: true };
  }

  async removeEdge(spec: EditableEdgeSpec) {
    const can = await this.canRemoveEdge(spec);
    if (!can.success) return can;
    this.#graph.edges = this.#graph.edges.filter((edge) => {
      return (
        edge.from !== spec.from ||
        edge.to !== spec.to ||
        edge.out !== spec.out ||
        edge.in !== spec.in
      );
    });
    this.#inspector = undefined;
    return { success: true };
  }

  raw() {
    return this.#graph;
  }

  inspect() {
    return (this.#inspector ??= inspectableGraph(this.#graph, {
      kits: this.#options.kits,
    }));
  }
}
