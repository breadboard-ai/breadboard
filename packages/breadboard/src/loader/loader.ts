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
  graphs?: SubGraphs;
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
  #graphs?: SubGraphs;
  #graphProviders: GraphProvider[];

  constructor({ graphs, graphProviders }: BoardLoaderArguments) {
    this.#graphs = graphs;
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

  async load(url: URL): Promise<GraphDescriptor | null> {
    if (url.hash) {
      // This is a bit of a special case: some graphs are constructed in
      // memory, so they don't have a URL to base on. In such cases, the
      // base URL will be the sentinel URL.
      if (sameWithoutHash(url, SENTINEL_BASE_URL)) {
        return this.#getSubgraph(url, this.#graphs);
      } else {
        const superGraph = await this.#loadOrWarn(removeHash(url));
        if (!superGraph) {
          return null;
        }
        return this.#getSubgraph(url, superGraph.graphs);
      }
    }
    return await this.#loadOrWarn(url);
  }
}
