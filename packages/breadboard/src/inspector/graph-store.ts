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
import {
  GraphLoader,
  GraphLoaderContext,
  GraphLoaderResult,
} from "../loader/types.js";
import { MutableGraphImpl } from "./graph/mutable-graph.js";
import {
  GraphStoreEntry,
  GraphStoreArgs,
  GraphStoreEventTarget,
  InspectableGraph,
  InspectableGraphOptions,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
  AddResult,
} from "./types.js";
import { hash } from "../utils/hash.js";
import { Kit, NodeHandlerContext, NodeHandlerMetadata } from "../types.js";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { createLoader } from "../loader/index.js";
import { SnapshotUpdater } from "../utils/snapshot-updater.js";
import { UpdateEvent } from "./graph/event.js";
import { createBuiltInKit } from "./graph/kits.js";
import { graphUrlLike } from "../utils/graph-url-like.js";
import { getGraphUrl, getGraphUrlComponents } from "../loader/loader.js";

export { GraphStore, makeTerribleOptions, contextFromMutableGraph };

function contextFromMutableGraph(mutable: MutableGraph): NodeHandlerContext {
  const store = mutable.store;
  return {
    kits: [...store.kits],
    loader: store.loader,
    sandbox: store.sandbox,
    graphStore: store,
    outerGraph: mutable.graph,
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

class GraphStore
  extends (EventTarget as GraphStoreEventTarget)
  implements MutableGraphStore
{
  readonly kits: readonly Kit[];
  readonly sandbox: Sandbox;
  readonly loader: GraphLoader;

  #legacyKits: GraphStoreEntry[];

  #mainGraphIds: Map<string, MainGraphIdentifier> = new Map();
  #mutables: Map<MainGraphIdentifier, SnapshotUpdater<MutableGraph>> =
    new Map();
  #dependencies: Map<MainGraphIdentifier, Set<MainGraphIdentifier>> = new Map();

  constructor(args: GraphStoreArgs) {
    super();
    this.kits = args.kits;
    this.sandbox = args.sandbox;
    this.loader = args.loader;
    this.#legacyKits = this.#populateLegacyKits(args.kits);
  }

  graphs(): GraphStoreEntry[] {
    const graphs = [...this.#mutables.entries()]
      .flatMap(([mainGraphId, snapshot]) => {
        const mutable = snapshot.current();
        const descriptor = mutable.graph;
        // TODO: Support exports and main module
        const mainGraphMetadata = filterEmptyValues({
          title: descriptor.title,
          description: descriptor.description,
          icon: descriptor.metadata?.icon,
          url: descriptor.url,
          tags: descriptor.metadata?.tags,
          help: descriptor.metadata?.help,
          id: mainGraphId,
        });
        return {
          mainGraph: mutable.legacyKitMetadata || mainGraphMetadata,
          ...mainGraphMetadata,
        };
      })
      .filter(Boolean) as GraphStoreEntry[];
    return [...this.#legacyKits, ...graphs];
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

  #populateLegacyKits(kits: Kit[]) {
    kits = [...kits, createBuiltInKit()];
    const all = kits.flatMap((kit) =>
      Object.entries(kit.handlers).map(([type, handler]) => {
        let metadata: NodeHandlerMetadata =
          "metadata" in handler ? handler.metadata || {} : {};
        const mainGraphTags = [...(kit.tags || [])];
        if (metadata.deprecated) {
          mainGraphTags.push("deprecated");
          metadata = { ...metadata };
          delete metadata.deprecated;
        }
        const tags = [...(metadata.tags || []), "component"];
        return [
          type,
          {
            url: type,
            mainGraph: filterEmptyValues({
              title: kit.title,
              description: kit.description,
              tags: mainGraphTags,
            }),
            ...metadata,
            tags,
          },
        ] as [type: string, info: GraphStoreEntry];
      })
    );
    return Object.values(
      all.reduce(
        (collated, [type, info]) => {
          // Intentionally do the reverse of what goes on
          // in `handlersFromKits`: last info wins,
          // because here, we're collecting info, rather
          // than handlers and the last info is the one
          // that typically has the right stuff.
          return { ...collated, [type]: info };
        },
        {} as Record<string, GraphStoreEntry>
      )
    );
  }

  registerKit(kit: Kit, dependences: MainGraphIdentifier[]): void {
    Object.keys(kit.handlers).forEach((type) => {
      if (graphUrlLike(type)) {
        const mutable = this.addByURL(type, dependences, {}).mutable;
        mutable.legacyKitMetadata = filterEmptyValues({
          url: kit.url,
          title: kit.title,
          description: kit.description,
          tags: kit.tags,
          id: mutable.id,
        });
      } else {
        throw new Error(
          `The type "${type}" is not Graph URL-like, unable to add this kit`
        );
      }
    });
  }

  addByDescriptor(graph: GraphDescriptor): Result<MainGraphIdentifier> {
    const getting = this.getOrAdd(graph, true);
    if (!getting.success) {
      return getting;
    }
    return { success: true, result: getting.result.id };
  }

  getByDescriptor(graph: GraphDescriptor): Result<MainGraphIdentifier> {
    const getting = this.getOrAdd(graph, false);
    if (!getting.success) {
      return getting;
    }
    return { success: true, result: getting.result.id };
  }

  editByDescriptor(
    graph: GraphDescriptor,
    options: EditableGraphOptions = {}
  ): EditableGraph | undefined {
    const result = this.getOrAdd(graph, true);
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

  inspectSnapshot(
    graph: GraphDescriptor,
    graphId: GraphIdentifier
  ): InspectableGraph | undefined {
    const immutable = this.#snapshotFromGraphDescriptor(graph).current();
    return immutable.graphs.get(graphId);
  }

  addByURL(
    path: string,
    dependencies: MainGraphIdentifier[],
    context: GraphLoaderContext = {}
  ): AddResult {
    const { mainGraphUrl, graphId, moduleId } = getGraphUrlComponents(
      getGraphUrl(path, context)
    );
    const id = this.#mainGraphIds.get(mainGraphUrl);
    if (id) {
      this.#addDependencies(id, dependencies);
      return { mutable: this.#mutables.get(id)!.current(), graphId, moduleId };
    }
    const snapshot = this.#snapshotFromUrl(mainGraphUrl, context);
    const mutable = snapshot.current();
    this.#mutables.set(mutable.id, snapshot);
    this.#mainGraphIds.set(mainGraphUrl, mutable.id);
    this.#addDependencies(mutable.id, dependencies);
    return { mutable, graphId, moduleId };
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

  getOrAdd(graph: GraphDescriptor, sameCheck: boolean): Result<MutableGraph> {
    let url = graph.url;
    let graphHash: number | null = null;
    if (!url) {
      graphHash = hash(graph);
      url = `hash:${graphHash}`;
    }

    // Find graph by URL.
    const id = this.#mainGraphIds.get(url);
    if (id) {
      const existing = this.#mutables.get(id)?.current();
      if (!existing) {
        return error(`Integrity error: main graph "${id}" not found in store.`);
      }
      const same =
        !sameCheck ||
        graphHash !== null ||
        hash(existing.graph) === hash(graph);
      if (!same) {
        // When not the same, rebuild the graph on the MutableGraphImpl.
        existing.rebuild(graph);
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

  /**
   * Creates a snapshot of a MutableGraph that is based on the
   * GraphDescriptor instance.
   *
   * This is basically a constant -- calling `refresh` doesn't do anything,
   * and `latest` is immediately resolved to the same value as `current`.
   *
   * @param graph
   * @returns
   */
  #snapshotFromGraphDescriptor(
    graph: GraphDescriptor
  ): SnapshotUpdater<MutableGraph> {
    const mutable = new MutableGraphImpl(graph, this);
    return new SnapshotUpdater({
      initial() {
        return mutable;
      },
      latest() {
        return Promise.resolve(mutable);
      },
      willUpdate() {},
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
      willUpdate: () => {
        this.dispatchEvent(
          new UpdateEvent(mutable.id, graphId, "", [
            ...(this.#dependencies.get(mutable.id) || []),
          ])
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

/**
 * A utility function to filter out empty (null or undefined) values from
 * an object.
 *
 * @param obj -- The object to filter.
 * @returns -- The object with empty values removed.
 */
function filterEmptyValues<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => !!value)
  ) as T;
}
