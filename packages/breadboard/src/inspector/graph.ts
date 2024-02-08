/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchemaBuilder } from "../schema.js";
import {
  GraphDescriptor,
  NodeDescriberResult,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../types.js";
import { inspectableNode } from "./node.js";
import { InspectableEdge, InspectableGraph, InspectableNode } from "./types.js";

export const inspectableGraph = (graph: GraphDescriptor): InspectableGraph => {
  return new Graph(graph);
};

class Graph implements InspectableGraph {
  #graph: GraphDescriptor;
  #nodes: InspectableNode[];
  #nodeMap: Map<NodeIdentifier, InspectableNode>;
  #typeMap: Map<NodeTypeIdentifier, InspectableNode[]> = new Map();
  #entries?: InspectableNode[];

  constructor(graph: GraphDescriptor) {
    this.#graph = graph;
    this.#nodes = this.#graph.nodes.map((node) => inspectableNode(node, this));
    this.#nodeMap = new Map(
      this.#nodes.map((node) => [node.descriptor.id, node])
    );
    this.#nodes.forEach((node) => {
      const type = node.descriptor.type;
      let list = this.#typeMap.get(type);
      if (!list) {
        list = [];
        this.#typeMap.set(type, list);
      }
      list.push(node);
    });
  }

  raw() {
    return this.#graph;
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#typeMap.get(type) || [];
  }

  nodeById(id: NodeIdentifier) {
    return this.#nodeMap.get(id);
  }

  nodes(): InspectableNode[] {
    return this.#nodes;
  }

  incomingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.to === id)
      .map((edge) => {
        return {
          from: this.nodeById(edge.from),
          out: edge.out,
          to: this.nodeById(edge.to),
          in: edge.in,
        };
      })
      .filter(
        (edge) => edge.from !== undefined && edge.to !== undefined
      ) as InspectableEdge[];
  }

  outgoingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.from === id)
      .map((edge) => {
        return {
          from: this.nodeById(edge.from),
          out: edge.out,
          to: this.nodeById(edge.to),
          in: edge.in,
        };
      })
      .filter(
        (edge) => edge.from !== undefined && edge.to !== undefined
      ) as InspectableEdge[];
  }

  entries(): InspectableNode[] {
    return (this.#entries ??= this.#nodes.filter((node) => node.isEntry()));
  }

  async describe(): Promise<NodeDescriberResult> {
    // TODO: Handle explicitly defined input/output schemas.
    const inputs = new SchemaBuilder();
    this.nodesByType("input")
      .filter((n) => n.isEntry())
      .flatMap((n) => n.outgoing())
      .forEach((edge) => {
        inputs.addProperty(edge.out, { type: "string" }).addRequired(edge.out);
      });
    const outputs = new SchemaBuilder();
    this.nodesByType("output")
      .filter((n) => n.isExit())
      .flatMap((n) => n.incoming())
      .forEach((edge) => {
        outputs.addProperty(edge.in, { type: "string" }).addRequired(edge.in);
      });

    return {
      outputSchema: inputs.build(),
      inputSchema: outputs.build(),
    };
  }
}
