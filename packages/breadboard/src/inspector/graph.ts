/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { handlersFromKits } from "../handler.js";
import { createLoader } from "../loader/index.js";
import { combineSchemas, removeProperty } from "../schema.js";
import {
  Edge,
  GraphDescriptor,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeIdentifier,
  NodeTypeIdentifier,
  Schema,
} from "../types.js";
import { InspectableEdgeCache } from "./edge.js";
import { collectKits } from "./kits.js";
import { InspectableNodeCache } from "./node.js";
import {
  EdgeType,
  describeInput,
  describeOutput,
  edgesToSchema,
} from "./schemas.js";
import {
  InspectableEdge,
  InspectableGraphOptions,
  InspectableGraphWithStore,
  InspectableKit,
  InspectableNode,
  InspectableSubgraphs,
  NodeTypeDescriberOptions,
} from "./types.js";

export const inspectableGraph = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraphWithStore => {
  return new Graph(graph, options);
};

const maybeURL = (url?: string): URL | undefined => {
  url = url || "";
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

class Graph implements InspectableGraphWithStore {
  #url?: URL;
  #kits?: InspectableKit[];
  #options: InspectableGraphOptions;

  #graph: GraphDescriptor;
  #nodes: InspectableNodeCache;
  #edges: InspectableEdgeCache;
  #graphs: InspectableSubgraphs | null = null;

  constructor(graph: GraphDescriptor, options?: InspectableGraphOptions) {
    this.#graph = graph;
    this.#url = maybeURL(graph.url);
    this.#options = options || {};
    this.#edges = new InspectableEdgeCache(this);
    this.#nodes = new InspectableNodeCache(this);
  }

  raw() {
    return this.#graph;
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#nodes.byType(type);
  }

  async describeType(
    type: NodeTypeIdentifier,
    options: NodeTypeDescriberOptions = {}
  ): Promise<NodeDescriberResult> {
    // The schema of an input or an output is defined by their
    // configuration schema or their incoming/outgoing edges.
    if (type === "input") {
      return describeInput(options);
    }
    if (type === "output") {
      return describeOutput(options);
    }

    const { kits } = this.#options;
    const handler = handlersFromKits(kits || [])[type];
    const asWired = {
      inputSchema: edgesToSchema(EdgeType.In, options?.incoming),
      outputSchema: edgesToSchema(EdgeType.Out, options?.outgoing),
    } satisfies NodeDescriberResult;
    if (!handler || !("describe" in handler) || !handler.describe) {
      return asWired;
    }
    const loader = this.#options.loader || createLoader();
    const context: NodeDescriberContext = {
      outerGraph: this.#graph,
      loader,
    };
    if (this.#url) {
      context.base = this.#url;
    }
    try {
      return handler.describe(
        options?.inputs || undefined,
        asWired.inputSchema,
        asWired.outputSchema,
        context
      );
    } catch (e) {
      console.warn(`Error describing node type ${type}`, e);
      return asWired;
    }
  }

  nodeById(id: NodeIdentifier) {
    return this.#nodes.get(id);
  }

  nodes(): InspectableNode[] {
    return this.#nodes.nodes();
  }

  edges(): InspectableEdge[] {
    return this.#edges.edges();
  }

  hasEdge(edge: Edge): boolean {
    return this.#edges.hasByValue(edge);
  }

  kits(): InspectableKit[] {
    return (this.#kits ??= collectKits(this.#options.kits || []));
  }

  incomingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.to === id)
      .map((edge) => this.#edges.getOrCreate(edge));
  }

  outgoingForNode(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph.edges
      .filter((edge) => edge.from === id)
      .map((edge) => this.#edges.getOrCreate(edge));
  }

  entries(): InspectableNode[] {
    return this.#nodes.nodes().filter((node) => node.isEntry());
  }

  async describe(): Promise<NodeDescriberResult> {
    const inputSchemas = (
      await Promise.all(
        this.nodesByType("input")
          .filter((n) => n.isEntry())
          .map((input) => input.describe())
      )
    ).map((result) => result.outputSchema);

    const outputSchemas = (
      await Promise.all(
        this.nodesByType("output")
          .filter((n) => n.isExit())
          .map((output) => output.describe())
      )
    )
      .map((result) =>
        result.inputSchema.behavior?.includes("bubble")
          ? null
          : result.inputSchema
      )
      .filter(Boolean) as Schema[];

    const inputSchema = combineSchemas(inputSchemas);
    const outputSchema = removeProperty(
      combineSchemas(outputSchemas),
      "schema"
    );

    console.groupEnd();

    return { inputSchema, outputSchema };
  }

  get nodeStore() {
    return this.#nodes;
  }

  get edgeStore() {
    return this.#edges;
  }

  #populateSubgraphs(): InspectableSubgraphs {
    const subgraphs = this.#graph.graphs;
    if (!subgraphs) return {};
    return Object.fromEntries(
      Object.entries(subgraphs).map(([id, descriptor]) => {
        return [id, new Graph(descriptor, this.#options)];
      })
    );
  }

  graphs(): InspectableSubgraphs {
    return (this.#graphs ??= this.#populateSubgraphs());
  }
}
