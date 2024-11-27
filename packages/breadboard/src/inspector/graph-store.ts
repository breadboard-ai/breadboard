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
import { GraphLoader, GraphLoaderContext } from "../loader/types.js";
import { MutableGraphImpl } from "./graph/mutable-graph.js";
import {
  GraphHandle,
  GraphStoreArgs,
  InspectableGraph,
  InspectableGraphOptions,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
} from "./types.js";
import { hash } from "../utils/hash.js";
import { Kit, NodeHandlerContext } from "../types.js";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { createLoader } from "../loader/index.js";

export { GraphStore, makeTerribleOptions, contextFromStore };

function contextFromStore(store: MutableGraphStore): NodeHandlerContext {
  return {
    kits: [...store.kits],
    loader: store.loader,
    sandbox: store.sandbox,
  };
}

// TODO: Deprecate and remove.
function makeTerribleOptions(
  options: InspectableGraphOptions = {}
): Required<InspectableGraphOptions> {
  return {
    kits: options.kits || [],
    sandbox: options.sandbox || {
      runModule() {
        throw new Error("Non-existent sandbox: Terrible Options were used.");
      },
    },
    loader: createLoader(),
  };
}

class GraphStore implements MutableGraphStore {
  readonly kits: readonly Kit[];
  readonly sandbox: Sandbox;
  readonly loader: GraphLoader;

  #mainGraphIds: Map<string, MainGraphIdentifier> = new Map();
  #mutables: Map<MainGraphIdentifier, MutableGraph> = new Map();

  constructor(args: GraphStoreArgs) {
    this.kits = args.kits;
    this.sandbox = args.sandbox;
    this.loader = args.loader;
  }

  async load(
    url: string,
    options: GraphLoaderContext
  ): Promise<Result<GraphHandle>> {
    const loader = this.loader;
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

  addByDescriptor(graph: GraphDescriptor): Result<MainGraphIdentifier> {
    const getting = this.getOrAdd(graph);
    if (!getting.success) {
      return getting;
    }
    return { success: true, result: getting.result.id };
  }

  editByDescriptor(
    graph: GraphDescriptor,
    options: EditableGraphOptions = {}
  ): EditableGraph | undefined {
    const result = this.getOrAdd(graph);
    if (!result.success) {
      console.error(`Failed to edityByDescriptor: ${result.error}`);
      return undefined;
    }
    return this.edit(result.result.id, options);
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
      const mutable = new MutableGraphImpl(graph, this);
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
