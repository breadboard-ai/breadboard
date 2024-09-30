/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inspect } from "../inspector/index.js";
import { loadWithFetch } from "../loader/default.js";
import { invokeGraph } from "../run/invoke-graph.js";
import {
  GraphDescriptor,
  InputValues,
  Kit,
  KitManifest,
  NodeDescriberContext,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeHandlerObject,
  Schema,
} from "../types.js";
import { asRuntimeKit } from "./ctors.js";

const setBaseURL = (base: URL, key: string, graph: GraphDescriptor) => {
  if (graph.edges && graph.nodes) {
    const url = new URL(base);
    url.searchParams.set("graph", key);
    return { ...graph, url: url.href };
  } else {
    throw new Error("Invalid graph descriptor");
  }
};

class GraphDescriptorNodeHandler implements NodeHandlerObject {
  #base: URL;
  #type: string;
  #graph: GraphDescriptor;
  metadata: NodeHandlerMetadata;

  constructor(base: URL, type: string, graph: GraphDescriptor) {
    this.#base = base;
    this.#type = type;
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
    return await inspect(this.#graph, {
      kits: context?.kits,
      loader: context?.loader,
    }).describe(inputs);
  }

  async invoke(inputs: InputValues, context: NodeHandlerContext) {
    return await invokeGraph(this.#graph, inputs, context);
  }
}

const createHandlersFromManifest = (base: URL, nodes: KitManifest["nodes"]) => {
  return Object.fromEntries(
    Object.entries(nodes).map(([key, value]) => {
      return [key, new GraphDescriptorNodeHandler(base, key, value)];
    })
  );
};

/**
 * Creates a runtime kit from manifest.
 * @param manifest -- a `KitManifest` instance
 */
export const fromManifest = (manifest: KitManifest): Kit => {
  const { title, description, version, url } = manifest;
  return {
    title,
    description,
    version,
    url,
    handlers: createHandlersFromManifest(new URL(url), manifest.nodes),
  };
};

const isKitManifest = (obj: unknown): obj is KitManifest => {
  if (typeof obj !== "object" || obj === null) return false;
  const manifest = obj as KitManifest;
  return (
    typeof manifest.title === "string" &&
    typeof manifest.description === "string" &&
    typeof manifest.version === "string" &&
    typeof manifest.url === "string" &&
    typeof manifest.nodes === "object"
  );
};

/**
 * Loads a kit from a URL.
 *
 * @param url -- a URL to a kit manifest or an npm URL.
 */
export const load = async (url: URL): Promise<Kit> => {
  if (url.protocol === "https:" || url.protocol === "http:") {
    if (url.pathname.endsWith(".kit.json")) {
      const maybeManifest = await loadWithFetch(url);
      if (isKitManifest(maybeManifest)) {
        return fromManifest(maybeManifest);
      }
    } else {
      // Assume that this is a URL to a JS file.
      const module = await import(/* @vite-ignore */ url.href);
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
