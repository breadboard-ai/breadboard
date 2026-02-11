/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssetPath,
  GraphDescriptor,
  GraphIdentifier,
  InspectableAsset,
  InspectableAssetEdge,
  InspectableEdge,
  InspectableNode,
  InspectableNodeType,
  ModuleIdentifier,
  MutableGraph,
  NodeConfiguration,
  NodeIdentifier,
  NodeTypeIdentifier,
  Outcome,
} from "@breadboard-ai/types";
import { err, graphUrlLike, TemplatePart } from "@breadboard-ai/utils";
import { getModuleId, isModule } from "../utils.js";
import { A2NodeType } from "./a2-node-type.js";
import { InspectableAssetImpl } from "./inspectable-asset.js";
import { VirtualNode } from "./virtual-node.js";
import { scanConfiguration } from "../../../utils/scan-configuration.js";
import { ROUTE_TOOL_PATH } from "../../../a2/a2/tool-manager.js";

export { GraphQueries, toolsFromConfiguration, routesFromConfiguration };

/**
 * Encapsulates common graph operations.
 */
class GraphQueries {
  #mutable: MutableGraph;
  #graphId: GraphIdentifier;

  constructor(cache: MutableGraph, graphId: GraphIdentifier) {
    this.#mutable = cache;
    this.#graphId = graphId;
  }

  #graph(): GraphDescriptor {
    const graph = this.#mutable.graph;
    return this.#graphId ? graph.graphs![this.#graphId]! : graph;
  }

  isEntry(id: NodeIdentifier): boolean {
    return this.incoming(id).length === 0;
  }

  isExit(id: NodeIdentifier): boolean {
    return this.outgoing(id).length === 0;
  }

  incoming(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph()
      .edges.filter((edge) => edge.to === id)
      .map((edge) => this.#mutable.edges.getOrCreate(edge, this.#graphId));
  }

  outgoing(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph()
      .edges.filter((edge) => edge.from === id)
      .map((edge) => this.#mutable.edges.getOrCreate(edge, this.#graphId));
  }

  entries(): InspectableNode[] {
    return this.#mutable.nodes
      .nodes(this.#graphId)
      .filter((node) => node.isEntry());
  }

  isStart(id: NodeIdentifier): boolean {
    if (this.#graphId) return false;
    return id === this.#mutable.entries.at(0);
  }

  nodeById(id: NodeIdentifier) {
    if (this.#graph().virtual) {
      return new VirtualNode({ id });
    }
    return this.#mutable.nodes.get(id, this.#graphId);
  }

  typeForNode(id: NodeIdentifier): InspectableNodeType | undefined {
    const node = this.nodeById(id);
    if (!node) {
      return undefined;
    }
    return this.typeById(node.descriptor.type);
  }

  typeById(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    if (!graphUrlLike(id)) {
      return undefined;
    }
    return new A2NodeType(id);
  }

  moduleExports(): Set<ModuleIdentifier> {
    const exports = this.#mutable.graph.exports;
    if (!exports) return new Set();
    return new Set(
      exports.filter((e) => isModule(e)).map((e) => getModuleId(e))
    );
  }

  graphExports(): Set<GraphIdentifier> {
    const exports = this.#mutable.graph.exports;
    if (!exports) return new Set();
    return new Set(exports.filter((e) => !isModule(e)).map((e) => e.slice(1)));
  }

  assets(): Map<AssetPath, InspectableAsset> {
    const entries = Object.entries(this.#mutable.graph.assets || []);
    return new Map(
      entries
        .filter(([path]) => !path.startsWith("@@"))
        .map(([path, asset]) => {
          return [path, new InspectableAssetImpl(path, asset)];
        })
    );
  }

  assetEdges(): Outcome<InspectableAssetEdge[]> {
    const edges: InspectableAssetEdge[] = [];
    const errors: string[] = [];
    for (const node of this.#mutable.nodes.nodes(this.#graphId)) {
      scanConfiguration(node.configuration(), (part) => {
        if (part.type !== "asset") return;

        const { path, invalid } = part;
        if (invalid) return;

        const asset = this.#mutable.graph.assets?.[path];
        if (!asset) {
          errors.push(
            `Node with id "${node.descriptor.id}" ("${node.title()}") refers to non-existent asset "${path}"`
          );
          return;
        }
        edges.push({
          direction: "load",
          asset: new InspectableAssetImpl(path, asset),
          node: node,
          assetPath: path,
        });
      });
    }
    if (errors.length > 0) {
      return err(errors.join("\n"));
    }
    return edges;
  }

  tools() {
    const tools: TemplatePart[] = [];
    for (const node of this.#mutable.nodes.nodes(this.#graphId)) {
      tools.push(...toolsFromConfiguration(node.configuration()));
    }
    return tools;
  }

  usesTool(path: string): boolean {
    return this.tools().some((tool) => tool.path === path);
  }

  routes(nodeId: NodeIdentifier) {
    const node = this.#mutable.nodes.get(nodeId, this.#graphId);
    if (!node) {
      return [];
    }
    return routesFromConfiguration(node.configuration());
  }
}

function toolsFromConfiguration(configuration: NodeConfiguration) {
  const tools: TemplatePart[] = [];
  scanConfiguration(configuration, (part) => {
    if (part.type === "tool") {
      tools.push(part);
    }
  });
  return tools;
}

function routesFromConfiguration(configuration: NodeConfiguration) {
  return toolsFromConfiguration(configuration)
    .filter((part) => part.path === ROUTE_TOOL_PATH && part.instance)
    .map((part) => part.instance!);
}
