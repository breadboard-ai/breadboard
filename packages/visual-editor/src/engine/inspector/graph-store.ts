/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditableGraph,
  EditableGraphOptions,
  GraphDescriptor,
  GraphIdentifier,
  GraphLoader,
  GraphLoaderContext,
  GraphLoaderResult,
  GraphStoreArgs,
  GraphStoreEventTarget,
  InspectableDescriberResultTypeCache,
  InspectableGraph,
  MutableGraph,
  MutableGraphStore,
} from "@breadboard-ai/types";
import { Graph as GraphEditor } from "../editor/graph.js";
import { DescribeResultTypeCache } from "./graph/describe-type-cache.js";

import { MutableGraphImpl } from "./graph/mutable-graph.js";
import { NodeTypeDescriberManager } from "./graph/node-type-describer-manager.js";

export { GraphStore };

class GraphStore
  extends (EventTarget as GraphStoreEventTarget)
  implements MutableGraphStore
{
  #loader: GraphLoader;
  #deps: GraphStoreArgs;
  #mutable: MutableGraph | undefined;

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
    this.#loader = args.loader;
    this.#deps = args;
    this.types = new DescribeResultTypeCache(
      new NodeTypeDescriberManager(this, args)
    );
  }

  async load(
    path: string,
    context: GraphLoaderContext
  ): Promise<GraphLoaderResult> {
    return this.#loader.load(path, context);
  }

  set(graph: GraphDescriptor): void {
    this.#mutable = new MutableGraphImpl(graph, this, this.#deps);
  }

  get(): MutableGraph | undefined {
    return this.#mutable;
  }

  edit(options: EditableGraphOptions = {}): EditableGraph | undefined {
    if (!this.#mutable) return undefined;
    return new GraphEditor(this.#mutable, options);
  }

  inspect(graphId: GraphIdentifier): InspectableGraph | undefined {
    if (!this.#mutable) return undefined;
    return this.#mutable.graphs.get(graphId);
  }
}
