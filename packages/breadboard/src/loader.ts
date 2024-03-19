/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, SubGraphs } from "./types.js";
import type { GraphProvider, GraphLoader } from "./loader/types.js";
import { createLoader } from "./loader/index.js";

export type BoardLoaderArguments = {
  base: URL;
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

export type BoardLoaderResult = {
  graph: GraphDescriptor;
  isSubgraph: boolean;
};

// TODO: Make this the actual GraphLoader, and use the code in GraphLoader
// here.
export class BoardLoader {
  #base: URL;
  #graphs?: SubGraphs;
  #loader: GraphLoader;

  constructor({ base, graphs, graphProviders, loader }: BoardLoaderArguments) {
    this.#base = base;
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

  #getSubgraph(url: URL, subgraphs?: SubGraphs): BoardLoaderResult {
    const hash = url.hash.substring(1);
    if (!subgraphs) {
      throw new Error("No sub-graphs to load from");
    }
    const graph = subgraphs[hash];
    if (!graph) {
      throw new Error(`No graph found for hash: #${hash}`);
    }
    graph.url = url.href;
    return { graph, isSubgraph: true };
  }

  async load(urlString: string): Promise<BoardLoaderResult> {
    const base = this.#base;
    const url = new URL(urlString, base);
    if (url.hash) {
      // This is a bit of a special case: some graphs are constructed in
      // memory, so they don't have a URL to base on. In such cases, the
      // existing machinery gets confused, using the URL of the module
      // as base. Hilarity ensues. This is a workaround for that.
      if (sameWithoutHash(url, base)) {
        return this.#getSubgraph(url, this.#graphs);
      } else {
        const superGraph = await this.#loadWithLoader(removeHash(url));
        return this.#getSubgraph(url, superGraph.graphs);
      }
    }
    const graph = await this.#loadWithLoader(url);
    return { graph, isSubgraph: false };
  }
}
