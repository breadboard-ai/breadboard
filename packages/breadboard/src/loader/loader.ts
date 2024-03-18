/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, SubGraphs } from "../types.js";
import type { GraphProvider, GraphLoader } from "./types.js";
import { SENTINEL_BASE_URL, createLoader } from "./index.js";

export type BoardLoaderArguments = {
  graphs?: SubGraphs;
  graphProviders?: GraphProvider[];
  loader?: GraphLoader;
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
  #loader: GraphLoader;

  constructor({ graphs, graphProviders, loader }: BoardLoaderArguments) {
    this.#graphs = graphs;
    this.#loader = loader || createLoader(graphProviders);
  }

  async #loadWithLoader(url: URL): Promise<GraphDescriptor> {
    const graph = await this.#loader.load(url);
    if (!graph) {
      throw new Error(`Unable to load graph from "${url.href}"`);
    }
    graph.url = url.href;
    return graph;
  }

  #getSubgraph(url: URL, subgraphs?: SubGraphs): GraphDescriptor {
    const hash = url.hash.substring(1);
    if (!subgraphs) {
      throw new Error("No sub-graphs to load from");
    }
    const graph = subgraphs[hash];
    if (!graph) {
      throw new Error(`No graph found for hash: #${hash}`);
    }
    graph.url = url.href;
    return graph;
  }

  async load(url: URL): Promise<GraphDescriptor> {
    if (url.hash) {
      // This is a bit of a special case: some graphs are constructed in
      // memory, so they don't have a URL to base on. In such cases, the
      // base URL will be the sentinel URL.
      if (sameWithoutHash(url, SENTINEL_BASE_URL)) {
        return this.#getSubgraph(url, this.#graphs);
      } else {
        const superGraph = await this.#loadWithLoader(removeHash(url));
        return this.#getSubgraph(url, superGraph.graphs);
      }
    }
    return await this.#loadWithLoader(url);
  }
}
