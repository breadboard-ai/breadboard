/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AddResult,
  EditableGraph,
  EditableGraphOptions,
  FileSystem,
  GraphDescriptor,
  GraphIdentifier,
  GraphLoader,
  GraphLoaderContext,
  GraphLoaderResult,
  GraphStoreArgs,
  GraphStoreEventTarget,
  InspectableDescriberResultTypeCache,
  InspectableGraph,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
  NodeHandlerContext,
  Result,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { hash, SnapshotUpdater } from "@breadboard-ai/utils";
import { Graph as GraphEditor } from "../editor/graph.js";
import { DescribeResultTypeCache } from "./graph/describe-type-cache.js";
import { UpdateEvent } from "./graph/event.js";

import { MutableGraphImpl } from "./graph/mutable-graph.js";
import { NodeTypeDescriberManager } from "./graph/node-type-describer-manager.js";
import { RunnableModuleFactory } from "@breadboard-ai/types/sandbox.js";
import { urlComponentsFromString } from "../loader/loader.js";

export { contextFromMutableGraph, contextFromMutableGraphStore, GraphStore };

function contextFromMutableGraph(mutable: MutableGraph): NodeHandlerContext {
  const store = mutable.store;
  return {
    loader: store.loader,
    sandbox: store.sandbox,
    graphStore: store,
    outerGraph: mutable.graph,
  };
}

function contextFromMutableGraphStore(
  store: MutableGraphStore
): NodeHandlerContext {
  return {
    loader: store.loader,
    sandbox: store.sandbox,
    graphStore: store,
  };
}

class GraphStore
  extends (EventTarget as GraphStoreEventTarget)
  implements MutableGraphStore
{
  readonly sandbox: RunnableModuleFactory;
  readonly loader: GraphLoader;
  readonly fileSystem: FileSystem;
  readonly flags: RuntimeFlagManager;

  #mainGraphIds: Map<string, MainGraphIdentifier> = new Map();
  #mutables: Map<MainGraphIdentifier, SnapshotUpdater<MutableGraph>> =
    new Map();
  #dependencies: Map<MainGraphIdentifier, Set<MainGraphIdentifier>> = new Map();

  /**
   * The cache of type describer results. These are currently
   * entirely static: they are only loaded once and exist
   * for the lifetime of the GraphStore. At the moment, this
   * is ok, since the only graph that ever changes is the main
   * graph, and we don't need its type. This will change
   * probably, so we need to be on look out for when.
   */
  public readonly types: InspectableDescriberResultTypeCache;

  constructor(args: GraphStoreArgs) {
    super();
    this.sandbox = args.sandbox;
    this.loader = args.loader;
    this.fileSystem = args.fileSystem;
    this.flags = args.flags;
    this.types = new DescribeResultTypeCache(
      new NodeTypeDescriberManager(this)
    );
  }

  async load(
    path: string,
    context: GraphLoaderContext
  ): Promise<GraphLoaderResult> {
    // Add loading graph as a dependency.
    const dependencies: MainGraphIdentifier[] = [];
    if (context) {
      const url = context.outerGraph?.url;
      if (url) {
        const outerMutable = this.addByURL(url, [], context);
        dependencies.push(outerMutable.mutable.id);
      }
    }

    const result = this.addByURL(path, dependencies, context);
    try {
      const mutable = await this.getLatest(result.mutable);
      return {
        success: true,
        graph: mutable.graph,
        subGraphId: result.graphId,
        moduleId: result.moduleId,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  getByDescriptor(graph: GraphDescriptor): Result<MainGraphIdentifier> {
    const getting = this.#getOrAdd(graph);
    if (!getting.success) {
      return getting;
    }
    return { success: true, result: getting.result.id };
  }

  editByDescriptor(
    graph: GraphDescriptor,
    options: EditableGraphOptions = {}
  ): EditableGraph | undefined {
    const result = this.#getOrAdd(graph);
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

  addByURL(
    path: string,
    dependencies: MainGraphIdentifier[],
    context: GraphLoaderContext = {}
  ): AddResult {
    const { mainGraphUrl, graphId, moduleId } = urlComponentsFromString(
      path,
      context
    );
    const id = this.#mainGraphIds.get(mainGraphUrl);
    if (id) {
      this.#addDependencies(id, dependencies);
      const snapshot = this.#mutables.get(id)!;
      return {
        mutable: snapshot.current(),
        graphId,
        moduleId,
        updating: snapshot.updating(),
      };
    }
    const snapshot = this.#snapshotFromUrl(mainGraphUrl, context);
    const mutable = snapshot.current();
    this.#mutables.set(mutable.id, snapshot);
    this.#mainGraphIds.set(mainGraphUrl, mutable.id);
    this.#addDependencies(mutable.id, dependencies);
    return {
      mutable,
      graphId,
      moduleId,
      updating: snapshot.updating(),
    };
  }

  async getLatest(mutable: MutableGraph): Promise<MutableGraph> {
    const snapshot = this.#mutables.get(mutable.id);
    if (!snapshot) {
      return mutable;
    }
    return snapshot.latest();
  }

  #addDependencies(
    id: MainGraphIdentifier,
    dependencies: MainGraphIdentifier[]
  ) {
    if (!dependencies.length) return;

    let deps: Set<MainGraphIdentifier> | undefined = this.#dependencies.get(id);
    if (!deps) {
      deps = new Set();
      this.#dependencies.set(id, deps);
    }
    dependencies.forEach((dependency) => {
      deps.add(dependency);
    });
  }

  #getOrAdd(graph: GraphDescriptor): Result<MutableGraph> {
    let url = graph.url;
    let graphHash: number | null = null;
    if (!url) {
      graphHash = hash(graph);
      url = `hash:${graphHash}`;
    }

    // Find graph by URL.
    const { mainGraphUrl } = urlComponentsFromString(url);
    const id = this.#mainGraphIds.get(mainGraphUrl);
    if (id) {
      const existing = this.#mutables.get(id)?.current();
      if (!existing) {
        return error(`Integrity error: main graph "${id}" not found in store.`);
      }
      return { success: true, result: existing };
    } else {
      // Brand new graph
      const snapshot = this.#snapshotFromGraphDescriptor(graph);
      const mutable = snapshot.current();
      this.#mutables.set(mutable.id, snapshot);
      this.#mainGraphIds.set(url, mutable.id);
      return { success: true, result: mutable };
    }
  }

  #snapshotFromGraphDescriptor(
    graph: GraphDescriptor
  ): SnapshotUpdater<MutableGraph> {
    // Create a simple static snapshot
    const mutable = new MutableGraphImpl(graph, this);
    return new SnapshotUpdater({
      initial() {
        return mutable;
      },
      latest() {
        return Promise.resolve(mutable);
      },
    });
  }

  #snapshotFromUrl(
    url: string,
    options: GraphLoaderContext
  ): SnapshotUpdater<MutableGraph> {
    const mutable = new MutableGraphImpl(emptyGraph(), this);
    let graphId = "";
    return new SnapshotUpdater({
      initial: () => mutable,
      latest: async () => {
        const loader = this.loader;
        if (!loader) {
          throw new Error(`Unable to load "${url}": no loader provided`);
        }
        const loading = await loader.load(url, options);
        if (!loading.success) {
          throw new Error(loading.error);
        }
        mutable.rebuild(loading.graph);
        graphId = loading.subGraphId || "";
        return mutable;
      },
      updated: () => {
        this.dispatchEvent(
          new UpdateEvent(
            mutable.id,
            graphId,
            "",
            [...(this.#dependencies.get(mutable.id) || [])],
            true
          )
        );
      },
    });
  }

  get(id: MainGraphIdentifier): MutableGraph | undefined {
    return this.#mutables.get(id)?.current();
  }
}

function error<T>(message: string): Result<T> {
  return {
    success: false,
    error: message,
  };
}

function emptyGraph(): GraphDescriptor {
  return {
    edges: [],
    nodes: [],
  };
}
