/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import {
  InspectableDescriberResultCache,
  InspectableEdgeCache,
  InspectableGraph,
  InspectableGraphCache,
  InspectableGraphOptions,
  InspectableKitCache,
  InspectableModuleCache,
  InspectableNodeCache,
  MutableGraph,
  MutableGraphIdentifier,
} from "../types.js";
import { Node } from "./node.js";
import { Edge } from "./edge.js";
import { ModuleCache } from "./module.js";
import { DescribeResultCache } from "../run/describe-cache.js";
import { KitCache } from "./kits.js";
import { GraphCache } from "./graph-cache.js";
import { Graph } from "./graph.js";
import { EdgeCache } from "./edge-cache.js";
import { NodeCache } from "./node-cache.js";
import { AffectedNode } from "../../editor/types.js";
import {
  isImperativeGraph,
  toDeclarativeGraph,
} from "../../run/run-imperative-graph.js";

export { MutableGraphImpl };

/**
 *
 * @deprecated This is the old way of getting an InspectableGraph instance.
 * @param graph
 * @param options
 * @returns
 */
export const inspectableGraph = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraph => {
  return new Graph("", new MutableGraphImpl(graph, options || {}));
};

class MutableGraphImpl implements MutableGraph {
  readonly options: InspectableGraphOptions;
  readonly id: MutableGraphIdentifier;

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
    this.id = crypto.randomUUID();
    this.rebuild(graph);
  }

  update(
    graph: GraphDescriptor,
    visualOnly: boolean,
    affectedNodes: AffectedNode[],
    affectedModules: ModuleIdentifier[]
  ): void {
    // TODO: Handle this a better way?
    for (const id of affectedModules) {
      this.modules.remove(id);
      if (!graph.modules || !graph.modules[id]) {
        continue;
      }

      this.modules.add(id, graph.modules[id]);

      // Find any nodes configured to use this module and clear its describer.
      const runModulesNodes = this.nodes.byType("runModule", "");
      for (const node of runModulesNodes) {
        if (
          node.configuration().$module &&
          node.configuration().$module === id &&
          !affectedNodes.find((n) => n.id === node.descriptor.id)
        ) {
          affectedNodes.push({
            id: node.descriptor.id,
            graphId: "",
          });
          visualOnly = false;
        }
      }
    }

    this.describe.clear(visualOnly, affectedNodes);
    this.graph = graph;
    this.graphs.rebuild(graph);
  }

  addSubgraph(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    this.graphs.add(graphId);
    this.nodes.addSubgraphNodes(subgraph, graphId);
    this.edges.addSubgraphEdges(subgraph, graphId);
  }

  removeSubgraph(graphId: GraphIdentifier): void {
    this.graphs.remove(graphId);
    this.nodes.removeSubgraphNodes(graphId);
    this.edges.removeSubgraphEdges(graphId);
  }

  rebuild(graph: GraphDescriptor) {
    if (isImperativeGraph(graph)) {
      graph = toDeclarativeGraph(graph);
    }
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
    this.edges = new EdgeCache(
      (edge, graphId) => new Edge(this, edge, graphId)
    );
    this.modules = new ModuleCache();
    this.describe = new DescribeResultCache();
    this.kits = new KitCache(this.options);
    this.graphs = new GraphCache((id) => new Graph(id, this));
    this.graphs.rebuild(graph);
    this.nodes.rebuild(graph);
    this.edges.rebuild(graph);
    this.modules.rebuild(graph);
    this.kits.rebuild(graph);
  }
}
