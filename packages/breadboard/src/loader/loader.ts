/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, SubGraphs } from "../types.js";
import type { GraphProvider, GraphLoader } from "./types.js";
import { DefaultGraphProvider } from "./default.js";

export const SENTINEL_BASE_URL = new URL("sentinel:///");

export type BoardLoaderArguments = {
  supergraph?: GraphDescriptor;
  graphProviders?: GraphProvider[];
};

export type BoardLoaderType = "hash" | "other";

export const removeHash = (url: URL): URL => {
  const newURL = new URL(url.href);
  newURL.hash = "";
  return newURL;
};

export const sameWithoutHash = (a: URL, b: URL): boolean => {
  return removeHash(a).href === removeHash(b).href;
};

export class BoardLoader implements GraphLoader {
  #graphProviders: GraphProvider[];
  #supergraph?: GraphDescriptor;

  constructor({ supergraph, graphProviders }: BoardLoaderArguments) {
    this.#supergraph = supergraph;
    this.#graphProviders = [
      ...(graphProviders || []),
      new DefaultGraphProvider(),
    ];
  }

  async #loadWithProviders(url: URL): Promise<GraphDescriptor | null> {
    for (const provider of this.#graphProviders) {
      const capabilities = provider.canProvide(url);
      if (capabilities === false) {
        continue;
      }
      if (capabilities.load) {
        const graph = await provider.load(url);
        if (graph !== null) {
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

  #getSubgraph(url: URL, subgraphs?: SubGraphs): GraphDescriptor | null {
    const hash = url.hash.substring(1);
    if (!subgraphs) {
      console.warn(`No sub-graphs to load "#${hash}" from`);
      return null;
    }
    const graph = subgraphs[hash];
    if (!graph) {
      console.warn(`No graph found for hash: #${hash}`);
      return null;
    }
    graph.url = url.href;
    return graph;
  }

  // TODO: Make Supergraphs an option here. They are part of the particular
  // load, rather than the loader itself.
  async load(url: URL): Promise<GraphDescriptor | null> {
    // If we don't have a hash, just load the graph.
    if (!url.hash) {
      return await this.#loadOrWarn(url);
    }

    // Check to see if we match a special case:
    // We are inside of a supergraph (a graph that contains us), _and_ we
    // are trying to load a peer subgraph.
    // In this case, do not trigger a load, but instead return the subgraph.
    if (this.#supergraph) {
      const supergraphURL = this.#supergraph.url
        ? new URL(this.#supergraph.url)
        : SENTINEL_BASE_URL;
      if (sameWithoutHash(url, supergraphURL)) {
        return this.#getSubgraph(url, this.#supergraph.graphs);
      }
    }
    // Otherwise, load the graph and then get its subgraph.
    const supergraph = await this.#loadOrWarn(removeHash(url));
    if (!supergraph) {
      return null;
    }
    return this.#getSubgraph(url, supergraph.graphs);
  }
}
