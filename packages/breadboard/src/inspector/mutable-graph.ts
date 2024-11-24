/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import {
  InspectableDescriberResultCache,
  InspectableEdgeCache,
  InspectableGraphCache,
  InspectableGraphOptions,
  InspectableGraphWithStore,
  InspectableKitCache,
  InspectableModuleCache,
  InspectableNodeCache,
  MutableGraph,
} from "./types.js";
import { Node, NodeCache } from "./node.js";
import { EdgeCache } from "./edge.js";
import { ModuleCache } from "./module.js";
import { DescribeResultCache } from "./run/describe-cache.js";
import { KitCache } from "./kits.js";
import { GraphCache } from "./graph-cache.js";
import { Graph } from "./graph.js";

export { MutableGraphImpl };

export const inspectableGraph = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraphWithStore => {
  return new Graph("", new MutableGraphImpl(graph, options || {}));
};

class MutableGraphImpl implements MutableGraph {
  readonly options: InspectableGraphOptions;

  // @ts-expect-error Initialized in rebuild.
  graph: GraphDescriptor;
  // @ts-expect-error Initialized in rebuild.
  graphs: InspectableGraphCache;
  // @ts-expect-error Initialized in rebuild.
  nodes: InspectableNodeCache;
  // @ts-expect-error Initialized in rebuild.
  edges: InspectableEdgeCache;
  // @ts-expect-error Initialized in rebuild.
  modules: InspectableModuleCache;
  // @ts-expect-error Initialized in rebuild.
  describe: InspectableDescriberResultCache;
  // @ts-expect-error Initialized in rebuild.
  kits: InspectableKitCache;

  constructor(graph: GraphDescriptor, options: InspectableGraphOptions) {
    this.options = options;
    this.rebuild(graph);
  }

  rebuild(graph: GraphDescriptor) {
    this.graph = graph;
    this.nodes = new NodeCache((descriptor, graphId) => {
      const graph = graphId ? this.graphs.get(graphId) : this;
      if (!graph) {
        throw new Error(
          `Inspect API Integrity error: unable to find subgraph "${graphId}"`
        );
      }
      return new Node(descriptor, this, graphId);
    });
    this.edges = new EdgeCache(this.nodes);
    this.modules = new ModuleCache();
    this.describe = new DescribeResultCache();
    this.kits = new KitCache(this.options);
    this.graphs = new GraphCache((id) => {
      return new Graph(id, this);
    });
    this.graphs.rebuild(graph);
    this.nodes.rebuild(graph);
    this.edges.rebuild(graph);
    this.modules.rebuild(graph);
    this.kits.rebuild(graph);
  }
}
