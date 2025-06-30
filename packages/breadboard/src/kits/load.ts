/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { invokeGraph } from "@breadboard-ai/runtime/legacy.js";
import type {
  GraphDescriptor,
  InputValues,
  Kit,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeHandlerObject,
  Schema,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { GraphDescriberManager } from "../inspector/graph/graph-describer-manager.js";
import { MutableGraphImpl } from "../inspector/graph/mutable-graph.js";

const setBaseURL = (base: URL, key: string, graph: GraphDescriptor) => {
  if (graph.edges && graph.nodes) {
    const url = new URL(base);
    url.searchParams.set("graph", key);
    return { ...graph, url: url.href };
  } else {
    throw new Error("Invalid graph descriptor");
  }
};

const emptyResult: NodeDescriberResult = {
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
};
class GraphDescriptorNodeHandler implements NodeHandlerObject {
  #graph: GraphDescriptor;
  metadata: NodeHandlerMetadata;

  constructor(base: URL, type: string, graph: GraphDescriptor) {
    this.#graph = setBaseURL(base, type, graph);
    this.describe = this.describe.bind(this);
    this.invoke = this.invoke.bind(this);
    const { title, description, metadata } = this.#graph;
    this.metadata = { title, description };
    if (metadata?.deprecated)
      this.metadata.deprecated = metadata.deprecated as boolean;
    if (metadata?.icon) this.metadata.icon = metadata.icon;
    if (metadata?.help) this.metadata.help = metadata.help;
    if (metadata?.tags) this.metadata.tags = metadata.tags;
  }

  async describe(
    inputs?: InputValues,
    _inputSchema?: Schema,
    _outputSchema?: Schema,
    context?: NodeDescriberContext
  ) {
    const graphStore = context?.graphStore;
    if (!graphStore) {
      console.warn("Unable to describe graph: no GraphStore supplied.");
      return emptyResult;
    }
    // TODO: Avoid creating a free-standing mutable graph here.
    const mutable = new MutableGraphImpl(this.#graph, graphStore);
    const describer = GraphDescriberManager.create("", mutable);
    if (!ok(describer)) {
      return emptyResult;
    }
    return await describer.describe(inputs);
  }

  async invoke(inputs: InputValues, context: NodeHandlerContext) {
    return await invokeGraph({ graph: this.#graph }, inputs, context);
  }
}

const createHandlersFromManifest = (base: URL, graph: GraphDescriptor) => {
  const graphs = graph.graphs!;
  const exports = graph.exports!.map((e) => {
    if (e.startsWith("#")) {
      return e.slice(1);
    }
    return e;
  });
  const entries = Object.entries(graphs)
    .filter(([key]) => exports.includes(key))
    .map(([key, value]) => {
      return [key, new GraphDescriptorNodeHandler(base, key, value)];
    });
  return Object.fromEntries(entries);
};

/**
 * Creates a runtime kit from a Graph Descriptor.
 */
export const kitFromGraphDescriptor = (
  graph: GraphDescriptor
): Kit | undefined => {
  if (!graph.graphs) {
    return;
  }
  const { title, description, version, url = "" } = graph;
  return {
    title,
    description,
    version,
    url,
    handlers: createHandlersFromManifest(new URL(url), graph),
  };
};
