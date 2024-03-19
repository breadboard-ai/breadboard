/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, SubGraphs } from "../types.js";
import type { GraphProvider, GraphLoader } from "./types.js";
import { DefaultGraphProvider } from "./default.js";

export const SENTINEL_BASE_URL = new URL("sentinel://sentinel/sentinel");

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

  constructor(graphProviders: GraphProvider[]) {
    this.#graphProviders = [...graphProviders, new DefaultGraphProvider()];
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
    url: URL | string,
    supergraph?: GraphDescriptor
  ): Promise<GraphDescriptor | null> {
    if (typeof url === "string") {
      // Can only query the supergraph.
      if (!supergraph) {
        throw new Error("Cannot load a graph by path without a supergraph");
      }
      const graph = this.#getSubgraph(
        null,
        url.substring(1),
        supergraph.graphs
      );
      if (!graph) {
        console.warn(`Unable to load graph from "${url}"`);
      }
      return graph;
    }

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
