/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableGraph, NodeIdentifier } from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { ok } from "@breadboard-ai/utils";
import {
  AssetEdgeIdentifier,
  AssetIdentifier,
  EdgeIdentifier,
} from "../../../types.js";
import {
  toAssetEdgeIdentifier,
  toEdgeIdentifier,
} from "../../../utils/helpers/helpers.js";

interface Selection {
  nodes: Set<NodeIdentifier>;
  edges: Set<EdgeIdentifier>;
  assets: Set<AssetIdentifier>;
  assetEdges: Set<AssetEdgeIdentifier>;
}

export class SelectionController extends RootController {
  @field()
  private accessor _selection: Selection = {
    nodes: new Set(),
    edges: new Set(),
    assets: new Set(),
    assetEdges: new Set(),
  };

  get selection(): Readonly<Selection> {
    return this._selection;
  }

  clear() {
    this.removeNodes();
    this.removeEdges();
    this.removeAssets();
    this.removeAssetEdges();
  }

  addNode(id: NodeIdentifier) {
    this._selection.nodes.add(id);
  }

  removeNode(id: NodeIdentifier) {
    this._selection.nodes.delete(id);
  }

  removeNodes() {
    this._selection.nodes.clear();
  }

  addEdge(id: EdgeIdentifier) {
    this._selection.edges.add(id);
  }

  removeEdge(id: EdgeIdentifier) {
    this._selection.edges.delete(id);
  }

  removeEdges() {
    this._selection.edges.clear();
  }

  addAsset(id: AssetIdentifier) {
    this._selection.assets.add(id);
  }

  removeAsset(id: AssetIdentifier) {
    this._selection.assets.delete(id);
  }

  removeAssets() {
    this._selection.assets.clear();
  }

  addAssetEdge(id: AssetEdgeIdentifier) {
    this._selection.assetEdges.add(id);
  }

  removeAssetEdge(id: AssetEdgeIdentifier) {
    this._selection.assetEdges.delete(id);
  }

  removeAssetEdges() {
    this._selection.assetEdges.clear();
  }

  selectAll(graph: InspectableGraph) {
    this.clear();
    for (const node of graph.nodes()) {
      this.addNode(node.descriptor.id);
    }

    for (const edge of graph.edges()) {
      this.addEdge(toEdgeIdentifier(edge.raw()));
    }

    for (const asset of graph.assets().keys()) {
      this.addAsset(asset);
    }

    const assetEdges = graph.assetEdges();
    if (ok(assetEdges)) {
      for (const assetEdge of assetEdges) {
        this.addAssetEdge(toAssetEdgeIdentifier(assetEdge));
      }
    }
  }
}
