/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphIdentifier,
  InspectableNode,
  InspectableNodeCache,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { Node } from "./node.js";

type NodeFactory = (
  node: NodeDescriptor,
  graphId: GraphIdentifier
) => InspectableNode;

export class NodeCache implements InspectableNodeCache {
  #factory: NodeFactory;
  #map: Map<GraphIdentifier, Map<NodeIdentifier, InspectableNode>> = new Map();
  #typeMap: Map<GraphIdentifier, Map<NodeTypeIdentifier, InspectableNode[]>> =
    new Map();

  constructor(factory: NodeFactory) {
    this.#factory = factory;
  }

  rebuild(graph: GraphDescriptor) {
    graph.nodes.forEach((node) => this.#addNodeInternal(node, ""));
    Object.entries(graph.graphs || {}).forEach(([graphId, graph]) => {
      graph.nodes.forEach((node) => this.#addNodeInternal(node, graphId));
    });
  }

  addSubgraphNodes(subgraph: GraphDescriptor, graphId: GraphIdentifier): void {
    subgraph.nodes.forEach((node) => this.#addNodeInternal(node, graphId));
  }

  removeSubgraphNodes(graphId: GraphIdentifier): void {
    const subgraph = this.#map.get(graphId);
    subgraph?.forEach((node) => {
      (node as Node).setDeleted();
    });
    this.#map.delete(graphId);
  }

  #addNodeInternal(node: NodeDescriptor, graphId: GraphIdentifier) {
    const graphTypes = getOrCreate(this.#typeMap, graphId, () => new Map());
    const inspectableNode = this.#factory(node, graphId);
    const type = node.type;
    let list = graphTypes.get(type);
    if (!list) {
      list = [];
      graphTypes.set(type, list);
    }
    list.push(inspectableNode);
    const graphNodes = getOrCreate(this.#map, graphId, () => new Map());
    graphNodes.set(node.id, inspectableNode);
    return inspectableNode;

    function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
      let v = map.get(key);
      if (v) return v;
      v = factory();
      map.set(key, v);
      return v;
    }
  }

  byType(
    type: NodeTypeIdentifier,
    graphId: GraphIdentifier
  ): InspectableNode[] {
    return this.#typeMap.get(graphId)?.get(type) || [];
  }

  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): InspectableNode | undefined {
    return this.#map.get(graphId)?.get(id);
  }

  add(node: NodeDescriptor, graphId: GraphIdentifier) {
    if (!this.#map) {
      return;
    }
    this.#addNodeInternal(node, graphId);
  }

  remove(id: NodeIdentifier, graphId: GraphIdentifier) {
    if (!this.#map) {
      return;
    }
    const nodeMap = this.#map.get(graphId);
    if (!nodeMap) {
      console.error(
        `Can't remove node "${id}": graph "${graphId}" was not found`
      );
      return;
    }
    const node = nodeMap.get(id) as Node;
    console.assert(node, "Node does not exist in cache.");
    const type = node!.descriptor.type;
    const list = this.#typeMap?.get(graphId)?.get(type);
    if (list) {
      const index = list.indexOf(node!);
      list.splice(index, 1);
    }
    nodeMap.delete(id);
    node.setDeleted();
  }

  nodes(graphId: GraphIdentifier): InspectableNode[] {
    return Array.from(this.#map.get(graphId)?.values() || []);
  }
}
