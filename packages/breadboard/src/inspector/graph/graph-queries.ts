/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphDescriptor,
  GraphIdentifier,
  ImportIdentifier,
  LLMContent,
  ModuleIdentifier,
  NodeConfiguration,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import {
  InspectableAsset,
  InspectableAssetEdge,
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodeType,
  MutableGraph,
} from "../types.js";
import { graphUrlLike } from "../../utils/graph-url-like.js";
import { createGraphNodeType } from "./kits.js";
import { VirtualNode } from "./virtual-node.js";
import { Outcome } from "../../data/types.js";
import { err } from "../../data/file-system/utils.js";
import { baseURLFromString, SENTINEL_BASE_URL } from "../../loader/loader.js";
import { getModuleId, isModule } from "../utils.js";
import { Template, TemplatePart } from "../../utils/template.js";
import { isLLMContent, isLLMContentArray } from "../../data/common.js";
import { InspectableAssetImpl } from "./inspectable-asset.js";

export { GraphQueries };

/**
 * Performs an action based on the supplied template part
 */
export type TemplatePartScanner = (part: TemplatePart) => void;

function scanConfiguration(
  config: NodeConfiguration,
  scanner: TemplatePartScanner
): void {
  for (const [, portValue] of Object.entries(config)) {
    let contents: LLMContent[] | null = null;
    if (isLLMContent(portValue)) {
      contents = [portValue];
    } else if (isLLMContentArray(portValue)) {
      contents = portValue;
    }
    if (!contents) continue;
    for (const content of contents) {
      for (const part of content.parts) {
        if ("text" in part) {
          const template = new Template(part.text);
          if (template.hasPlaceholders) {
            template.transform((part) => {
              scanner(part);
              return part;
            });
          }
        }
      }
    }
  }
}

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
    const knownNodeType = this.#mutable.kits.getType(id);
    if (knownNodeType) {
      return knownNodeType;
    }
    if (!graphUrlLike(id)) {
      return undefined;
    }
    return createGraphNodeType(id, this.#mutable);
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

  async imports(): Promise<Map<ImportIdentifier, Outcome<InspectableGraph>>> {
    if (this.#graphId || !this.#mutable.graph.imports) return new Map();

    const results: Map<ImportIdentifier, Outcome<InspectableGraph>> = new Map();
    const entries = Object.entries(this.#mutable.graph.imports);
    for (const [name, value] of entries) {
      let outcome: Outcome<InspectableGraph> = err(
        `Unknown error resolving import "${name}`
      );
      if (!value || !("url" in value)) {
        outcome = err(`Invalid import value "${JSON.stringify(value)}`);
      } else {
        try {
          const url = new URL(
            value.url,
            baseURLFromString(this.#mutable.graph.url) || SENTINEL_BASE_URL
          ).href;
          const store = this.#mutable.store;
          const adding = store.addByURL(url, [this.#mutable.id], {});
          const mutable = await store.getLatest(adding.mutable);
          const inspectable = store.inspect(mutable.id, "");
          if (!inspectable) {
            outcome = err(`Unable to inspect graph at URL "${url}`);
          } else {
            outcome = inspectable;
          }
        } catch (e) {
          outcome = err((e as Error).message);
        } finally {
          results.set(name, outcome);
        }
      }
    }
    return results;
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
}
