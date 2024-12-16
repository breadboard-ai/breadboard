/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModuleIdentifier } from "@breadboard-ai/types";
import type { GraphDescriptor, GraphToRun } from "../types.js";
import type {
  GraphProvider,
  GraphLoader,
  GraphLoaderContext,
  GraphLoaderResult,
} from "./types.js";

export const SENTINEL_BASE_URL = new URL("sentinel://sentinel/sentinel");
const MODULE_PREFIX = "module:";

export { resolveGraph, getGraphUrl, getGraphUrlComponents };

function getGraphUrl(path: string, context: GraphLoaderContext): URL {
  const base = baseURLFromContext(context);
  return new URL(path, base);
}

function getGraphUrlComponents(url: URL): {
  mainGraphUrl: string;
  graphId: string;
  moduleId?: string;
} {
  const noHash = removeHash(url);
  const mainGraphUrl = noHash.href;
  const graphId = url.hash.slice(1);
  if (graphId.startsWith(MODULE_PREFIX)) {
    return {
      mainGraphUrl,
      graphId: "",
      moduleId: graphId.slice(MODULE_PREFIX.length),
    };
  } else if (graphId) {
    return { mainGraphUrl, graphId };
  }
  return { mainGraphUrl, graphId: "" };
}

function resolveGraph(graphToRun: GraphToRun): GraphDescriptor {
  const { graph, subGraphId, moduleId } = graphToRun;
  if (moduleId) {
    const title = graph.modules?.[moduleId]?.metadata?.title || moduleId;
    const url = graph.url?.startsWith(MODULE_PREFIX)
      ? graph.url
      : `${MODULE_PREFIX}${moduleId}:${graph.url}`;
    return { ...graph, main: moduleId, url, title };
  }
  return subGraphId ? graph.graphs![subGraphId] : graph;
}

export const removeHash = (url: URL): URL => {
  const newURL = new URL(url.href);
  newURL.hash = "";
  return newURL;
};

export const sameWithoutHash = (a: URL, b: URL): boolean => {
  return removeHash(a).href === removeHash(b).href;
};

export const baseURLFromContext = (context: GraphLoaderContext) => {
  let urlString;
  if (context.outerGraph?.url) {
    urlString = context.outerGraph.url;
  } else if (context.board?.url) {
    urlString = context.board?.url;
  }
  if (urlString) {
    // Account for generated module URL, created in `resolveGraph`.
    if (urlString.startsWith(MODULE_PREFIX)) {
      // remove MODULE_PREFIX and moduleId
      urlString = urlString.split(":").slice(2).join(":");
    }
    return new URL(urlString);
  }
  if (context.base) return context.base;
  return SENTINEL_BASE_URL;
};

export class Loader implements GraphLoader {
  #graphProviders: GraphProvider[];

  constructor(graphProviders: GraphProvider[]) {
    this.#graphProviders = graphProviders;
  }

  async #loadWithProviders(url: URL): Promise<GraphLoaderResult> {
    for (const provider of this.#graphProviders) {
      const capabilities = provider.canProvide(url);
      if (capabilities === false) {
        continue;
      }
      if (capabilities.load) {
        const response = await provider.load(url);
        const graph: GraphDescriptor =
          typeof response == "string" ? JSON.parse(response) : response;
        if (graph !== null) {
          graph.url = url.href;
          return { success: true, graph };
        }
      }
    }
    const error = `Unable to load graph from "${url.href}"`;
    console.warn(error);
    return { success: false, error };
  }

  async #loadOrWarn(url: URL): Promise<GraphLoaderResult> {
    return this.#loadWithProviders(url);
  }

  #getSubgraph(
    url: URL | null,
    hash: string,
    supergraph: GraphDescriptor
  ): GraphLoaderResult {
    const isModule = hash.startsWith(MODULE_PREFIX);
    if (isModule) {
      const modules = supergraph.modules;
      const moduleId: ModuleIdentifier = hash.slice(MODULE_PREFIX.length);
      if (!modules) {
        const error = `No modules to load "${moduleId}" from`;
        console.warn(error);
        return { success: false, error };
      }
      const module = modules[moduleId];
      if (!module) {
        const error = `No module found for module ID: ${moduleId}`;
        console.warn(error);
        return { success: false, error };
      }
      return { success: true, graph: supergraph, moduleId };
    }

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

  async load(
    path: string,
    context: GraphLoaderContext
  ): Promise<GraphLoaderResult> {
    const supergraph = context.outerGraph;
    // This is a special case, when we don't have URLs to resolve against.
    // We are a hash path, and we are inside of a supergraph that doesn't
    // have its own URL. We can only query the supergraph directly.
    // No other URL resolution is possible.
    const isEphemeralSupergraph =
      path.startsWith("#") && supergraph && !supergraph.url;
    if (isEphemeralSupergraph) {
      return this.#getSubgraph(null, path.substring(1), supergraph);
    }

    const url = getGraphUrl(path, context);

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
        return this.#getSubgraph(url, hash, supergraph);
      }
    }
    // Otherwise, load the graph and then get its subgraph.
    const loadedSupergraphResult = await this.#loadOrWarn(removeHash(url));
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
