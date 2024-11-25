/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import {
  InspectableGraphOptions,
  MutableGraph,
  MutableGraphIdentifier,
  MutableGraphStore,
} from "./types.js";
import { MutableGraphImpl } from "./graph/mutable-graph.js";

export { MutableGraphStoreImpl };

class MutableGraphStoreImpl implements MutableGraphStore {
  #options: InspectableGraphOptions;
  #graphs: Map<MutableGraphIdentifier, MutableGraph> = new Map();

  constructor(options: InspectableGraphOptions) {
    this.#options = options;
  }

  add(graph: GraphDescriptor): MutableGraph {
    const mutable = new MutableGraphImpl(graph, this.#options);
    this.#graphs.set(mutable.id, mutable);
    return mutable;
  }

  get(id: MutableGraphIdentifier): MutableGraph | undefined {
    return this.#graphs.get(id);
  }
}
