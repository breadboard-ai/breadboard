/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, SubGraphs } from "@google-labs/graph-runner";

export type BoardLoaderArguments = Pick<GraphDescriptor, "url" | "graphs">;

export type BoardLoaderType = "file" | "fetch" | "hash" | "unknown";

export type BoardLoaders = Record<
  BoardLoaderType,
  (path: string) => Promise<GraphDescriptor>
>;

export type ResolverResult = {
  type: BoardLoaderType;
  location: string;
  href: string;
};

export const resolveURL = (
  base: URL,
  urlString: string,
  results: ResolverResult[]
): boolean => {
  const url = new URL(urlString, base);
  const hash = url.hash;
  const href = url.href;
  const path = url.protocol === "file:" ? url.pathname : undefined;
  const baseWithoutHash = base.href.replace(base.hash, "");
  const hrefWithoutHash = href.replace(hash, "");
  if (baseWithoutHash == hrefWithoutHash && hash) {
    results.push({ type: "hash", location: hash.substring(1), href });
    return true;
  }
  const result: ResolverResult = path
    ? { type: "file", location: path, href }
    : href
    ? { type: "fetch", location: hrefWithoutHash, href }
    : { type: "unknown", location: "", href };
  results.push(result);
  return !hash;
};

export const loadFromFile = async (path: string) => {
  if (typeof globalThis.process === "undefined")
    throw new Error("Unable to use `path` when not running in node");
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(path, "utf-8"));
};

export const loadWithFetch = async (url: string) => {
  const response = await fetch(url);
  return await response.json();
};

export class BoardLoadingStep {
  loaders: BoardLoaders;
  graphs?: SubGraphs;

  constructor(graphs?: SubGraphs) {
    this.loaders = {
      file: loadFromFile,
      fetch: loadWithFetch,
      hash: async (hash: string) => {
        if (!graphs) throw new Error("No graphs to load from");
        return graphs[hash];
      },
      unknown: async () => {
        throw new Error("Unable to determine Board loader type");
      },
    };
  }

  async load(result: ResolverResult): Promise<GraphDescriptor> {
    const graph = await this.loaders[result.type](result.location);
    graph.url = result.href;
    return graph;
  }
}

export class BoardLoader {
  #base: URL;
  #graphs?: SubGraphs;

  constructor({ url, graphs }: BoardLoaderArguments) {
    this.#base = new URL(url ?? import.meta.url);
    this.#graphs = graphs;
  }

  async load(urlString: string): Promise<GraphDescriptor> {
    const results: ResolverResult[] = [];
    let base = this.#base;
    while (!resolveURL(base, urlString, results)) {
      base = new URL(results[results.length - 1].href);
    }
    let graph: GraphDescriptor | undefined;
    let subgraphs = this.#graphs;
    for (const result of results) {
      const step = new BoardLoadingStep(subgraphs);
      graph = await step.load(result);
      subgraphs = graph.graphs;
    }
    if (!graph)
      throw new Error(
        "BoardLoader failed to load a graph. This error likely indicates a bug in the BoardLoader."
      );
    return graph;
  }
}
