/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/graph-runner";

export class BoardLoader {
  #base: URL;

  constructor(base?: string) {
    this.#base = new URL(base ?? import.meta.url);
  }

  async load($ref: string): Promise<GraphDescriptor> {
    const url = new URL($ref, this.#base);
    const href = url.href;
    const path = url.protocol === "file:" ? url.pathname : undefined;
    const graph = await BoardLoader.loadGraph(path, href);
    graph.url = url.href;
    return graph;
  }

  /**
   * @todo Make this just take a $ref and figure out when it's a path or a URL.
   * @param path
   * @param ref
   * @returns
   */
  static async loadGraph(path?: string, ref?: string) {
    if (path && typeof process === "undefined")
      throw new Error("Unable to use `path` when not running in node");
    if (path) {
      const { readFile } = await import("node:fs/promises");
      return JSON.parse(await readFile(path, "utf-8"));
    }
    if (!ref) throw new Error("To include, we need a path or a $ref");
    const response = await fetch(ref);
    return await response.json();
  }
}
