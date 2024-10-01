/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeMetadata,
  StartLabel,
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
import { collectPorts } from "./ports.js";
import { EdgeType } from "./schemas.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  InspectableNodeType,
  InspectablePortList,
  NodeTypeDescriberOptions,
} from "./types.js";

class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: InspectableGraph;

  constructor(descriptor: NodeDescriptor, graph: InspectableGraph) {
    this.descriptor = descriptor;
    this.#graph = graph;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }

  description(): string {
    return this.descriptor.metadata?.description || this.title();
  }

  incoming(): InspectableEdge[] {
    return this.#graph.incomingForNode(this.descriptor.id);
  }

  outgoing(): InspectableEdge[] {
    return this.#graph.outgoingForNode(this.descriptor.id);
  }

  isEntry(label: StartLabel = "default"): boolean {
    const labels = this.startLabels();
    if (labels) {
      return labels.includes(label);
    } else if (label !== "default") {
      return false;
    }
    return this.incoming().length === 0;
  }

  startLabels(): StartLabel[] | undefined {
    const tags = this.descriptor?.metadata?.tags || [];
    const labels: StartLabel[] = [];
    for (const tag of tags) {
      if (typeof tag === "string" && tag === "start") {
        labels.push("default");
      } else if (tag.type === "start") {
        labels.push(tag.label || "default");
      }
    }
    return labels.length > 0 ? labels : undefined;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }

  type(): InspectableNodeType {
    const type = this.#graph.typeForNode(this.descriptor.id);
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
    return this.#graph.describeType(this.descriptor.type, {
      inputs: this.#inputsAndConfig(options.inputs, this.configuration()),
      incoming: options.incoming,
      outgoing: options.outgoing,
    });
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
    return { inputs, outputs };
  }
}

export class NodeCache {
  #graph: InspectableGraph;
  #map?: Map<NodeIdentifier, InspectableNode>;
  #typeMap?: Map<NodeTypeIdentifier, InspectableNode[]>;

  constructor(graph: InspectableGraph) {
    this.#graph = graph;
  }

  populate(graph: GraphDescriptor) {
    graph.nodes.forEach((node) => this.#addNodeInternal(node));
  }

  #addNodeInternal(node: NodeDescriptor) {
    this.#typeMap ??= new Map();
    this.#map ??= new Map();
    const inspectableNode = new Node(node, this.#graph);
    const type = node.type;
    let list = this.#typeMap.get(type);
    if (!list) {
      list = [];
      this.#typeMap.set(type, list);
    }
    list.push(inspectableNode);
    this.#map.set(node.id, inspectableNode);
    return inspectableNode;
  }

  #ensureNodeMap() {
    if (this.#map) return this.#map;
    this.populate(this.#graph.raw());
    this.#map ??= new Map();
    return this.#map!;
  }

  byType(type: NodeTypeIdentifier): InspectableNode[] {
    this.#ensureNodeMap();
    return this.#typeMap?.get(type) || [];
  }

  get(id: string): InspectableNode | undefined {
    return this.#ensureNodeMap().get(id);
  }

  add(node: NodeDescriptor) {
    if (!this.#map) {
      return;
    }
    console.assert(!this.#map.has(node.id), "Node already exists in cache.");
    this.#addNodeInternal(node);
  }

  remove(id: NodeIdentifier) {
    if (!this.#map) {
      return;
    }
    const node = this.#map.get(id);
    console.assert(node, "Node does not exist in cache.");
    const type = node!.descriptor.type;
    const list = this.#typeMap?.get(type);
    if (list) {
      const index = list.indexOf(node!);
      list.splice(index, 1);
    }
    this.#map.delete(id);
  }

  nodes(): InspectableNode[] {
    return Array.from(this.#ensureNodeMap().values());
  }
}
