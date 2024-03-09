/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import { GraphUUID, InspectableGraphStore } from "./types.js";

const toUUID = (url: string): GraphUUID => {
  return `0|${url}`;
};

export class GraphStore implements InspectableGraphStore {
  #entries = new Map<GraphUUID, GraphDescriptor>();
  #ids = new Map<string, GraphUUID>();

  #getOrSetGraphId(graph: GraphDescriptor): GraphUUID {
    if (graph.url) {
      return toUUID(graph.url);
    }
    // if there's no URL, fallback to stringifying the graph
    // and making a blob URL.
    // TODO: Remove the needs for this. All graphs must have a URL.
    const key = JSON.stringify(graph);
    if (this.#ids.has(key)) {
      return this.#ids.get(key) as GraphUUID;
    }
    const id = toUUID(
      URL.createObjectURL(new Blob([key], { type: "application/json" }))
    );
    this.#ids.set(key, id);
    return id;
  }

  has(id: GraphUUID) {
    return this.#entries.has(id);
  }

  add(graph: GraphDescriptor) {
    const id = this.#getOrSetGraphId(graph);
    if (this.#entries.has(id)) return id;
    this.#entries.set(id, graph);
    return id;
  }

  get(id: GraphUUID) {
    return this.#entries.get(id);
  }
}
