/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphLoader,
  GraphLoaderResult,
  GraphProvider,
} from "@breadboard-ai/types";

export { getGraphUrl, getGraphUrlComponents, urlComponentsFromString };

function getGraphUrl(path: string): URL {
  return new URL(path);
}

function getGraphUrlComponents(url: URL): {
  mainGraphUrl: string;
  graphId: string;
} {
  const noHash = removeHash(url);
  const mainGraphUrl = noHash.href;
  const graphId = url.hash.slice(1);
  if (graphId) {
    return { mainGraphUrl, graphId };
  }
  return { mainGraphUrl, graphId: "" };
}

export const removeHash = (url: URL): URL => {
  const newURL = new URL(url.href);
  newURL.hash = "";
  return newURL;
};

function urlComponentsFromString(urlString: string): {
  mainGraphUrl: string;
  graphId: string;
} {
  return getGraphUrlComponents(getGraphUrl(urlString));
}

export class Loader implements GraphLoader {
  #graphProvider: GraphProvider;

  constructor(graphProvider: GraphProvider) {
    this.#graphProvider = graphProvider;
  }

  async #loadWithProvider(url: URL): Promise<GraphLoaderResult> {
    const provider = this.#graphProvider;
    const capabilities = provider.canProvide(url);
    if (capabilities === false || !capabilities.load) {
      const error = `Unable to load graph from "${url.href}"`;
      console.warn(error);
      return { success: false, error };
    }
    const response = await provider.load(url);
    const graph: GraphDescriptor =
      typeof response == "string" ? JSON.parse(response) : response;
    if (graph !== null) {
      // TODO(aomarks) This is a bit weird. We stick the resourcekey onto
      // the URL for the purposes of loading, because there isn't another
      // way to pass it through the loading process currently. But, most of
      // our code doesn't expect to see a resource key in the URL, so we
      // need to remove it from the graph JSON.
      graph.url = url.href.replace(/\?resourcekey=[^/?&#]*/, "");
      return { success: true, graph };
    }
    const error = `Unable to load graph from "${url.href}"`;
    console.warn(error);
    return { success: false, error };
  }

  #getSubgraph(
    url: URL | null,
    hash: string,
    supergraph: GraphDescriptor
  ): GraphLoaderResult {
    const subgraphs = supergraph.graphs;
    if (!subgraphs) {
      const error = `No subgraphs to load "#${hash}" from`;
      console.warn(error);
      return { success: false, error };
    }
    const graph = subgraphs[hash];
    if (!graph) {
      const error = `No subgraph found for hash: #${hash}`;
      console.warn(error);
      return { success: false, error };
    }
    if (url) graph.url = url.href;
    return { success: true, graph: supergraph, subGraphId: hash };
  }

  async load(path: string): Promise<GraphLoaderResult> {
    const url = getGraphUrl(path);

    // If we don't have a hash, just load the graph.
    if (!url.hash) {
      return await this.#loadWithProvider(url);
    }

    // Load the graph and then get its subgraph.
    const loadedSupergraphResult = await this.#loadWithProvider(
      removeHash(url)
    );
    if (!loadedSupergraphResult.success) {
      return loadedSupergraphResult;
    }
    return this.#getSubgraph(
      url,
      url.hash.substring(1),
      loadedSupergraphResult.graph
    );
  }
}
