/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { handlersFromKits } from "../handler.js";
import { combineSchemas } from "../schema.js";
import {
  GraphDescriptor,
  NodeDescriberResult,
  NodeIdentifier,
  NodeTypeIdentifier,
  Schema,
} from "../types.js";
import { inspectableNode } from "./node.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableGraphOptions,
  InspectableNode,
  NodeTypeDescriberOptions,
} from "./types.js";

export const inspectableGraph = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraph => {
  return new Graph(graph, options);
};

const emptyDescriberResult = async (): Promise<NodeDescriberResult> => {
  return {
    inputSchema: {},
    outputSchema: {},
  };
};

const edgesToSchema = (edges?: InspectableEdge[]): Schema => {
  if (!edges) return {};
  return {
    type: "object",
    properties: edges.reduce((acc, edge) => {
      acc[edge.out] = { type: "string" };
      return acc;
    }, {} as Record<string, Schema>),
  };
};

class Graph implements InspectableGraph {
  #graph: GraphDescriptor;
  #nodes: InspectableNode[];
  #nodeMap: Map<NodeIdentifier, InspectableNode>;
  #typeMap: Map<NodeTypeIdentifier, InspectableNode[]> = new Map();
  #entries?: InspectableNode[];
  #options: InspectableGraphOptions;

  constructor(graph: GraphDescriptor, options?: InspectableGraphOptions) {
    this.#graph = graph;
    this.#options = options || {};
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

  async describeType(
    type: NodeTypeIdentifier,
    options: NodeTypeDescriberOptions = {}
  ): Promise<NodeDescriberResult> {
    const { kits } = this.#options;
    const handler = handlersFromKits(kits || [])[type];
    if (!handler || typeof handler === "function" || !handler.describe) {
      return emptyDescriberResult();
    }
    return handler.describe(
      options?.inputs || undefined,
      edgesToSchema(options?.incoming),
      edgesToSchema(options?.outgoing)
    );
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
    const inputSchemas = (
      await Promise.all(
        this.nodesByType("input")
          .filter((n) => n.isEntry())
          .map((input) => input.describe())
      )
    ).map((result) => result.inputSchema);

    const outputSchemas = (
      await Promise.all(
        this.nodesByType("output")
          .filter((n) => n.isExit())
          .map((output) => output.describe())
      )
    ).map((result) => result.outputSchema);

    return {
      inputSchema: combineSchemas(inputSchemas),
      outputSchema: combineSchemas(outputSchemas),
    };
  }
}
