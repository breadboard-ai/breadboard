/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, SubGraphs } from "../types.js";
import type {
  GraphProvider,
  GraphLoader,
  GraphLoaderContext,
} from "./types.js";

export const SENTINEL_BASE_URL = new URL("sentinel://sentinel/sentinel");

export const removeHash = (url: URL): URL => {
  const newURL = new URL(url.href);
  newURL.hash = "";
  return newURL;
};

export const sameWithoutHash = (a: URL, b: URL): boolean => {
  return removeHash(a).href === removeHash(b).href;
};

export const baseURLFromContext = (context: GraphLoaderContext) => {
  if (context.outerGraph?.url) return new URL(context.outerGraph.url);
  const invokingBoardURL = context.board?.url;
  if (invokingBoardURL) return new URL(invokingBoardURL);
  if (context.base) return context.base;
  return SENTINEL_BASE_URL;
};

export class Loader implements GraphLoader {
  #graphProviders: GraphProvider[];

  constructor(graphProviders: GraphProvider[]) {
    this.#graphProviders = graphProviders;
  }

  async #loadWithProviders(url: URL): Promise<GraphDescriptor | null> {
    for (const provider of this.#graphProviders) {
      const capabilities = provider.canProvide(url);
      if (capabilities === false) {
        continue;
      }
      if (capabilities.load) {
        const response = await provider.load(url);
        const graph: GraphDescriptor = typeof response == "string" ? JSON.parse(response) : response;
        if (graph !== null) {
          // TODO: Remove this on 2024/9/1. By then, surely all of the graphs
          // would have migrated to use the new name.
          graph.nodes?.map((node) => {
            if (node.type === "superWorker") {
              console.warn("superWorker encountered, converting to specialist");
              node.type = "specialist";
            }
          });
          graph.url = url.href;
          return graph;
        }
      }
    }
    console.warn(`Unable to load graph from "${url.href}"`);
    return null;
  }

  async #loadOrWarn(url: URL): Promise<GraphDescriptor | null> {
    const graph = await this.#loadWithProviders(url);
    if (!graph) {
      return null;
    }
    return graph;
  }

  #getSubgraph(
    url: URL | null,
    hash: string,
    subgraphs?: SubGraphs
  ): GraphDescriptor | null {
    if (!subgraphs) {
      console.warn(`No subgraphs to load "#${hash}" from`);
      return null;
    }
    const graph = subgraphs[hash];
    if (!graph) {
      console.warn(`No subgraph found for hash: #${hash}`);
      return null;
    }
    if (url) graph.url = url.href;
    return graph;
  }

  async load(
    path: string,
    context: GraphLoaderContext
  ): Promise<GraphDescriptor | null> {
    const supergraph = context.outerGraph;
    // This is a special case, when we don't have URLs to resolve against.
    // We are a hash path, and we are inside of a supergraph that doesn't
    // have its own URL. We can only query the supergraph directly.
    // No other URL resolution is possible.
    const isEphemeralSupergraph =
      path.startsWith("#") && supergraph && !supergraph.url;
    if (isEphemeralSupergraph) {
      const graph = this.#getSubgraph(
        null,
        path.substring(1),
        supergraph.graphs
      );
      if (!graph) {
        console.warn(`Unable to load graph from "${path}"`);
      }
      return graph;
    }

    const base = baseURLFromContext(context);

    const url = new URL(path, base);

    // If we don't have a hash, just load the graph.
    if (!url.hash) {
      return await this.#loadOrWarn(url);
    }

    // Check to see if we match a special case:
    // We are inside of a supergraph (a graph that contains us), _and_ we
    // are trying to load a peer subgraph.
    // In this case, do not trigger a load, but instead return the subgraph.
    if (supergraph) {
      const supergraphURL = supergraph.url
        ? new URL(supergraph.url)
        : SENTINEL_BASE_URL;
      if (sameWithoutHash(url, supergraphURL)) {
        const hash = url.hash.substring(1);
        return this.#getSubgraph(url, hash, supergraph.graphs);
      }
    }
    // Otherwise, load the graph and then get its subgraph.
    const loadedSupergraph = await this.#loadOrWarn(removeHash(url));
    if (!loadedSupergraph) {
      return null;
    }
    return this.#getSubgraph(
      url,
      url.hash.substring(1),
      loadedSupergraph.graphs
    );
  }
}
