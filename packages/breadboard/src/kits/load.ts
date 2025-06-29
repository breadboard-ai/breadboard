/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadWithFetch } from "@breadboard-ai/loader";
import { invokeGraph } from "@breadboard-ai/runtime/legacy.js";
import type {
  GraphDescriptor,
  InputValues,
  Kit,
  MutableGraphStore,
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
import { asRuntimeKit } from "./ctors.js";

export { registerKitGraphs };

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

function isGraphDescriptor(obj: unknown): obj is GraphDescriptor {
  if (typeof obj !== "object" || obj === null) return false;
  const graph = obj as GraphDescriptor;
  return (
    typeof graph.title === "string" &&
    typeof graph.description === "string" &&
    typeof graph.version === "string" &&
    typeof graph.graphs === "object" &&
    Array.isArray(graph.exports)
  );
}

/**
 * Loads a kit from a URL.
 *
 * @param url -- a URL to a kit manifest or an npm URL.
 */
export const load = async (url: URL): Promise<Kit> => {
  if (url.protocol === "https:" || url.protocol === "http:") {
    if (url.pathname.endsWith(".kit.json")) {
      const maybeManifest = await loadWithFetch(url);
      if (isGraphDescriptor(maybeManifest)) {
        const kit = kitFromGraphDescriptor(maybeManifest);
        if (!kit) {
          throw new Error(`Unable to import kit from "${url}"`);
        }
        return kit;
      }
    } else {
      // Assume that this is a URL to a JS file.
      const module = await import(
        /* @vite-ignore */
        /* webpackIgnore: true */
        url.href
      );
      if (module.default == undefined) {
        throw new Error(`Module ${url} does not have a default export.`);
      }

      const moduleKeys = Object.getOwnPropertyNames(module.default.prototype);

      if (
        moduleKeys.includes("constructor") == false ||
        moduleKeys.includes("handlers") == false
      ) {
        throw new Error(
          `Module default export '${url}' does not look like a Kit (either no constructor or no handler).`
        );
      }
      return asRuntimeKit(module.default);
    }
  } else if (url.protocol === "file:") {
    throw new Error("File protocol is not yet supported");
  }
  throw new Error(`Unable to load kit from "${url}"`);
};

/**
 * A helper function for registering old-style graph kits that are
 * created using `kitFromGraphDescriptor`.
 *
 * Call it to ensure that the graphs, representing the node handlers
 * for these kits are in the graph store, so that the graph store doesn't
 * attempt to load them (their URLs are just URIs).
 *
 * @param legacyKitGraphs -- loosely, Agent Kit and Google Drive Kit
 * @param graphStore
 */
function registerKitGraphs(
  legacyKitGraphs: GraphDescriptor[],
  graphStore: MutableGraphStore
): void {
  for (const project of legacyKitGraphs) {
    if (!project.graphs) continue;
    for (const [key, graph] of Object.entries(project.graphs)) {
      graphStore.addByDescriptor({
        ...graph,
        url: `${project.url}?graph=${key}`,
      });
    }
  }
}
