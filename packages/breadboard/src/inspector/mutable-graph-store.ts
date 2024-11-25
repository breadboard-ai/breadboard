/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphIdentifier } from "@breadboard-ai/types";
import { Graph as GraphEditor } from "../editor/graph.js";
import {
  EditableGraph,
  EditableGraphOptions,
  Result,
} from "../editor/types.js";
import { GraphLoaderContext } from "../loader/types.js";
import { MutableGraphImpl } from "./graph/mutable-graph.js";
import {
  GraphHandle,
  InspectableGraph,
  InspectableGraphOptions,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
} from "./types.js";
import { hash } from "../utils/hash.js";

export { GraphStore };

class GraphStore implements MutableGraphStore {
  #options: InspectableGraphOptions;
  #mainGraphIds: Map<string, MainGraphIdentifier> = new Map();
  #mutables: Map<MainGraphIdentifier, MutableGraph> = new Map();

  constructor(options: InspectableGraphOptions) {
    this.#options = options;
  }

  async load(
    url: string,
    options: GraphLoaderContext
  ): Promise<Result<GraphHandle>> {
    const loader = this.#options.loader;
    if (!loader) {
      return error(`Unable to load "${url}": no loader provided`);
    }
    const loading = await loader.load(url, options);
    if (!loading.success) {
      return loading;
    }
    const { graph, subGraphId: graphId = "" } = loading;
    const mutable = this.getOrAdd(graph);
    if (!mutable.success) {
      return mutable;
    }
    return {
      success: true,
      result: { type: "declarative", id: mutable.result.id, graphId },
    };
  }

  edit(
    id: MainGraphIdentifier,
    options: EditableGraphOptions = {}
  ): EditableGraph | undefined {
    const mutable = this.get(id);
    if (!mutable) return undefined;

    return new GraphEditor(mutable, options);
  }

  inspect(
    id: MainGraphIdentifier,
    graphId: GraphIdentifier
  ): InspectableGraph | undefined {
    const mutable = this.get(id);
    if (!mutable) return undefined;

    return mutable.graphs.get(graphId);
  }

  getOrAdd(graph: GraphDescriptor): Result<MutableGraph> {
    let url = graph.url;
    let graphHash: number | null = null;
    if (!url) {
      graphHash = hash(graph);
      url = `hash:${graphHash}`;
    }

    // Find graph by URL.
    const id = this.#mainGraphIds.get(url);
    if (id) {
      const existing = this.#mutables.get(id);
      if (!existing) {
        return error(`Integrity error: main graph "${id}" not found in store.`);
      }
      const same = graphHash !== null || hash(existing.graph) === hash(graph);
      if (!same) {
        // When not the same, rebuild the graph on the MutableGraphImpl.
        existing.rebuild(graph);
      }
      return { success: true, result: existing };
    } else {
      // Brand new graph
      const mutable = new MutableGraphImpl(graph, this.#options);
      this.#mutables.set(mutable.id, mutable);
      this.#mainGraphIds.set(url, mutable.id);
      return { success: true, result: mutable };
    }
  }

  get(id: MainGraphIdentifier): MutableGraph | undefined {
    return this.#mutables.get(id);
  }
}

function error<T>(message: string): Result<T> {
  return {
    success: false,
    error: message,
  };
}
