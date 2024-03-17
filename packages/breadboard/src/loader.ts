/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphLoader } from "./index.js";
import { GraphDescriptor, SubGraphs } from "./types.js";
import { GraphProvider } from "./loader/types.js";
import { createLoader } from "./loader/index.js";

export type BoardLoaderArguments = {
  base: URL;
  graphs?: SubGraphs;
  graphProviders?: GraphProvider[];
};

export type BoardLoaderType = "file" | "fetch" | "hash" | "unknown";

export type BoardLoaders = Record<
  BoardLoaderType,
  (url: URL) => Promise<GraphDescriptor>
>;

export type ResolverResult = {
  type: BoardLoaderType;
  location: URL;
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
  const baseWithoutHash = base.href.replace(base.hash, "");
  const hrefWithoutHash = href.replace(hash, "");
  if (baseWithoutHash == hrefWithoutHash && hash) {
    results.push({ type: "hash", location: url, href });
    return true;
  }
  let result: ResolverResult;
  const path = url.pathname;
  if (path) {
    // A bit hacky: file URLs typically don't have hostnames, so this is
    // how we detect if this is not a file URL.
    const isUnknown = !!path && !!url.hostname;
    if (isUnknown) {
      result = { type: "unknown", location: new URL(hrefWithoutHash), href };
    } else {
      result = { type: "file", location: new URL(hrefWithoutHash), href };
    }
  } else if (href) {
    result = { type: "fetch", location: new URL(hrefWithoutHash), href };
  } else {
    result = { type: "unknown", location: new URL(hrefWithoutHash), href };
  }
  results.push(result);
  return !hash;
};

export const loadFromFile = async (path: string) => {
  if (typeof globalThis.process === "undefined")
    throw new Error("Unable to use `path` when not running in node");
  let readFileFn;
  // The CJS transpilation process for node/vscode seems to miss this import,
  // and leaves it as an import statement rather than converting it to a
  // require. We therefore need a runtime check that prefers `require` if it
  // is available.
  if (typeof require === "function") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFile } = require("node:fs/promises");
    readFileFn = readFile;
  } else {
    const { readFile } = await import(/* vite-ignore */ "node:fs/promises");
    readFileFn = readFile;
  }

  return JSON.parse(await readFileFn(path, "utf-8"));
};

export const loadWithFetch = async (url: string | URL) => {
  const response = await fetch(url);
  return await response.json();
};

export class BoardLoadingStep {
  loaders: BoardLoaders;
  graphs?: SubGraphs;
  loader?: GraphLoader;

  constructor(graphs?: SubGraphs, loader?: GraphLoader) {
    const loadWithLoader = async (url: URL) => {
      if (loader) {
        const graph = await loader.load(url);
        if (graph) return graph;
      }
      throw new Error("Unable to determine Board loader type");
    };
    this.loaders = {
      file: loadWithLoader,
      fetch: loadWithLoader,
      unknown: loadWithLoader,
      hash: async (url: URL) => {
        const hash = url.hash.substring(1);
        if (!graphs) {
          throw new Error("No sub-graphs to load from");
        }
        const graph = graphs[hash];
        if (!graph) {
          throw new Error(`No graph found for hash: #${hash}`);
        }
        return graph;
      },
    };
  }

  async load(result: ResolverResult): Promise<GraphDescriptor> {
    const graph = await this.loaders[result.type](result.location);
    graph.url = result.href;
    return graph;
  }
}

export type BoardLoaderResult = {
  graph: GraphDescriptor;
  isSubgraph: boolean;
};

export class BoardLoader {
  #base: URL;
  #graphs?: SubGraphs;
  #graphProviders?: GraphProvider[];

  constructor({ base, graphs, graphProviders }: BoardLoaderArguments) {
    this.#base = base;
    this.#graphs = graphs;
    this.#graphProviders = graphProviders;
  }

  async load(urlString: string): Promise<BoardLoaderResult> {
    const results: ResolverResult[] = [];
    let base = this.#base;
    while (!resolveURL(base, urlString, results)) {
      base = new URL(results[results.length - 1].href);
    }
    let graph: GraphDescriptor | undefined;
    let subgraphs = this.#graphs;
    let isSubgraph = true;
    const loader = createLoader(this.#graphProviders);
    for (const result of results) {
      if (result.type !== "hash") {
        isSubgraph = false;
      }
      const step = new BoardLoadingStep(subgraphs, loader);
      graph = await step.load(result);
      subgraphs = graph.graphs;
    }
    if (!graph)
      throw new Error(
        "BoardLoader failed to load a graph. This error likely indicates a bug in the BoardLoader."
      );
    return { graph, isSubgraph };
  }
}
