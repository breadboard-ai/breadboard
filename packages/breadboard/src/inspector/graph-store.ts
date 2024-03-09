/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import { InspectableGraphStore, UUID } from "./types.js";

export class GraphStore implements InspectableGraphStore {
  #entries = new Map<UUID, GraphDescriptor>();
  #ids = new Map<string, UUID>();

  #getOrSetGraphId(graph: GraphDescriptor) {
    // if there's no URL, fallback to stringifying the graph.
    const key = graph.url ?? JSON.stringify(graph);
    if (this.#ids.has(key)) {
      return this.#ids.get(key) as UUID;
    }
    const id = crypto.randomUUID();
    this.#ids.set(key, id);
    return id;
  }

  has(id: UUID) {
    return this.#entries.has(id);
  }

  add(graph: GraphDescriptor) {
    const id = this.#getOrSetGraphId(graph);
    if (this.#entries.has(id)) return id;
    this.#entries.set(id, graph);
    return id;
  }

  get(id: UUID) {
    return this.#entries.get(id);
  }
}
