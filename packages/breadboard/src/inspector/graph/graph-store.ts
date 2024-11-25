/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../../types.js";
import { GraphUUID, GraphDescriptorStore } from "./../types.js";

const toUUID = (url: string, version: number): GraphUUID => {
  return `${version}|${url}`;
};

export class GraphStore implements GraphDescriptorStore {
  #entries = new Map<GraphUUID, GraphDescriptor>();
  #ids = new Map<string, GraphUUID>();

  #getOrSetGraphId(graph: GraphDescriptor, version: number): GraphUUID {
    if (graph.url) {
      return toUUID(graph.url, version);
    }
    // if there's no URL, fallback to stringifying the graph
    // and making a blob URL.
    // TODO: Remove the needs for this. All graphs must have a URL.
    const key = JSON.stringify(graph);
    if (this.#ids.has(key)) {
      return this.#ids.get(key) as GraphUUID;
    }
    const id = toUUID(
      URL.createObjectURL(new Blob([key], { type: "application/json" })),
      version
    );
    this.#ids.set(key, id);
    return id;
  }

  has(id: GraphUUID) {
    return this.#entries.has(id);
  }

  add(graph: GraphDescriptor, version: number) {
    const id = this.#getOrSetGraphId(graph, version);
    if (this.#entries.has(id)) return { id, added: false };
    this.#entries.set(id, graph);
    return { id, added: true };
  }

  get(id: GraphUUID) {
    return this.#entries.get(id);
  }
}
