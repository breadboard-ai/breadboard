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
    // This does not work consistently.
    // First, it's slow. JSONifying the graph is slow.
    // Second, it's unreliable, because it depends on string interning,
    // and will result in duplicate IDs for the same graph.
    // TODO: Make this fast and reliable.
    const graphString = JSON.stringify(graph);
    if (this.#ids.has(graphString)) {
      return this.#ids.get(graphString) as UUID;
    }
    const id = crypto.randomUUID();
    this.#ids.set(graphString, id);
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
