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
  GraphHandleToBeNamed,
  GraphStoreArgs,
  GraphStoreEventTarget,
  InspectableGraph,
  InspectableGraphOptions,
  InspectableKit,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
} from "./types.js";
import { hash } from "../utils/hash.js";
import { Kit, NodeHandlerContext, NodeHandlerMetadata } from "../types.js";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { createLoader } from "../loader/index.js";
import { SnapshotUpdater } from "../utils/snapshot-updater.js";
import { UpdateEvent } from "./graph/event.js";
import { collectCustomNodeTypes } from "./graph/kits.js";

export { GraphStore, makeTerribleOptions, contextFromStore };

function contextFromStore(store: MutableGraphStore): NodeHandlerContext {
  return {
    kits: [...store.kits],
    loader: store.loader,
    sandbox: store.sandbox,
    graphStore: store,
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

  #legacyKits: GraphHandleToBeNamed[];

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

  graphs(): GraphHandleToBeNamed[] {
    const graphs = [...this.#mutables.entries()]
      .flatMap(([mainGraphId, snapshot]) => {
        const mutable = snapshot.current();
        // TODO: Support exports and main module
        const inspectable = mutable.graphs.get("");
        if (!inspectable) {
          return null;
        }
        const descriptor = inspectable.raw();
        return filterEmptyValues({
          title: descriptor.title,
          description: descriptor.description,
          icon: descriptor.metadata?.icon,
          url: descriptor.url,
          tags: descriptor.metadata?.tags,
          help: descriptor.metadata?.help,
        });
      })
      .filter(Boolean) as GraphHandleToBeNamed[];
    return [...this.#legacyKits, ...graphs];
  }

  #populateLegacyKits(kits: Kit[]) {
    return kits.flatMap((kit) =>
      Object.entries(kit.handlers).map(([type, handler]) => {
        const metadata: NodeHandlerMetadata =
          "metadata" in handler ? handler.metadata || {} : {};
        return {
          url: type,
          ...metadata,
        };
      })
    );
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
    url: string,
    dependencies: MainGraphIdentifier[],
    context: GraphLoaderContext = {}
  ): MutableGraph {
    const id = this.#mainGraphIds.get(url);
    if (id) {
      this.#addDependencies(id, dependencies);
      return this.#mutables.get(id)!.current();
    }
    const snapshot = this.#snapshotFromUrl(url, context);
    const mutable = snapshot.current();
    this.#mutables.set(mutable.id, snapshot);
    this.#mainGraphIds.set(url, mutable.id);
    this.#addDependencies(mutable.id, dependencies);
    return mutable;
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

  addKits(kits: Kit[], dependencies: MainGraphIdentifier[]): InspectableKit[] {
    return [
      ...kits.map((kit) => {
        const descriptor = {
          title: kit.title,
          description: kit.description,
          url: kit.url,
          tags: kit.tags || [],
        };
        return {
          descriptor,
          nodeTypes: collectCustomNodeTypes(kit.handlers, dependencies, this),
        };
      }),
    ];
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
