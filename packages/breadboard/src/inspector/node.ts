/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import {
  InputValues,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  OutputValues,
} from "../types.js";
import { collectPorts, filterSidePorts } from "./ports.js";
import { EdgeType } from "./schemas.js";
import {
  InspectableEdge,
  InspectableNode,
  InspectableNodeCache,
  InspectableNodePorts,
  InspectableNodeType,
  InspectablePortList,
  MutableGraph,
  NodeTypeDescriberOptions,
} from "./types.js";
import { GraphQueries } from "./graph-queries.js";
import { DescriberManager } from "./describer-manager.js";

export class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: MutableGraph;
  #graphId: GraphIdentifier;
  #deleted = false;

  constructor(
    descriptor: NodeDescriptor,
    graph: MutableGraph,
    graphId: GraphIdentifier
  ) {
    this.descriptor = descriptor;
    this.#graph = graph;
    this.#graphId = graphId;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }

  description(): string {
    return this.descriptor.metadata?.description || this.title();
  }

  incoming(): InspectableEdge[] {
    return new GraphQueries(this.#graph, this.#graphId).incoming(
      this.descriptor.id
    );
  }

  outgoing(): InspectableEdge[] {
    return new GraphQueries(this.#graph, this.#graphId).outgoing(
      this.descriptor.id
    );
  }

  isEntry(): boolean {
    return this.incoming().length === 0;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }

  type(): InspectableNodeType {
    const type = new GraphQueries(this.#graph, this.#graphId).typeForNode(
      this.descriptor.id
    );
    if (!type) {
      throw new Error(
        `Possible integrity error: node ${this.descriptor.id} does not have a type`
      );
    }
    return type;
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  metadata(): NodeMetadata {
    return this.descriptor.metadata || {};
  }

  #inputsAndConfig(inputs?: InputValues, config?: NodeConfiguration) {
    // Config first, then inputs on top. Inputs override config.
    return { ...config, ...inputs };
  }

  async #describeInternal(
    options: NodeTypeDescriberOptions
  ): Promise<NodeDescriberResult> {
    const manager = DescriberManager.create(this.#graphId, this.#graph);
    if (!manager.success) {
      throw new Error(`Inspect API Integrity Error: ${manager.error}`);
    }
    return manager.result.describeNodeType(
      this.descriptor.id,
      this.descriptor.type,
      {
        inputs: this.#inputsAndConfig(options.inputs, this.configuration()),
        incoming: options.incoming,
        outgoing: options.outgoing,
      }
    );
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    return this.#describeInternal({
      inputs,
      incoming: this.incoming(),
      outgoing: this.outgoing(),
    });
  }

  async ports(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): Promise<InspectableNodePorts> {
    const incoming = this.incoming();
    const outgoing = this.outgoing();
    const described = await this.#describeInternal({
      inputs: inputValues,
      incoming,
      outgoing,
    });
    const inputs: InspectablePortList = {
      fixed: described.inputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.In,
        incoming,
        described.inputSchema,
        false,
        true,
        this.#inputsAndConfig(inputValues, this.configuration())
      ),
    };
    const side: InspectablePortList = {
      fixed: true,
      ports: filterSidePorts(inputs),
    };
    const addErrorPort =
      this.descriptor.type !== "input" && this.descriptor.type !== "output";
    const outputs: InspectablePortList = {
      fixed: described.outputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.Out,
        outgoing,
        described.outputSchema,
        addErrorPort,
        false,
        outputValues
      ),
    };
    return { inputs, outputs, side };
  }

  setDeleted() {
    this.#deleted = true;
  }

  deleted() {
    return this.#deleted;
  }
}

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
