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
} from "../../../../types.js";
import {
  toAssetEdgeIdentifier,
  toEdgeIdentifier,
} from "../../../../utils/helpers/helpers.js";

export type { Selection };

interface Selection {
  nodes: Set<NodeIdentifier>;
  edges: Set<EdgeIdentifier>;
  assets: Set<AssetIdentifier>;
  assetEdges: Set<AssetEdgeIdentifier>;
}

export class SelectionController extends RootController {
  /**
   * Incremented when selection changes. Used by triggers to detect
   * selection changes without reading the full selection state.
   */
  @field()
  private accessor _selectionId: number = 0;

  @field({ deep: true })
  private accessor _selection: Selection = {
    nodes: new Set(),
    edges: new Set(),
    assets: new Set(),
    assetEdges: new Set(),
  };

  get selectionId(): number {
    return this._selectionId;
  }

  get selection(): Readonly<Selection> {
    return this._selection;
  }

  /**
   * Returns the single selected node when exactly one node is selected
   * and nothing else is selected, or null otherwise.
   */
  get selectedNodeId(): NodeIdentifier | null {
    if (this.size !== 1) return null;
    if (this._selection.nodes.size !== 1) return null;
    return [...this._selection.nodes][0];
  }

  get size(): number {
    return (
      this._selection.assetEdges.size +
      this._selection.assets.size +
      this._selection.edges.size +
      this._selection.nodes.size
    );
  }

  deselectAll() {
    this._selectionId++;
    this.removeNodes();
    this.removeEdges();
    this.removeAssets();
    this.removeAssetEdges();
  }

  addNode(id: NodeIdentifier) {
    this._selectionId++;
    this._selection.nodes.add(id);
  }

  removeNode(id: NodeIdentifier) {
    this._selectionId++;
    this._selection.nodes.delete(id);
  }

  removeNodes() {
    this._selection.nodes.clear();
  }

  /**
   * Clear the current selection and select the given nodes.
   */
  selectNodes(ids: NodeIdentifier[]) {
    this.deselectAll();
    for (const id of ids) {
      this.addNode(id);
    }
  }

  addEdge(id: EdgeIdentifier) {
    this._selectionId++;
    this._selection.edges.add(id);
  }

  removeEdge(id: EdgeIdentifier) {
    this._selectionId++;
    this._selection.edges.delete(id);
  }

  removeEdges() {
    this._selection.edges.clear();
  }

  addAsset(id: AssetIdentifier) {
    this._selectionId++;
    this._selection.assets.add(id);
  }

  removeAsset(id: AssetIdentifier) {
    this._selectionId++;
    this._selection.assets.delete(id);
  }

  removeAssets() {
    this._selection.assets.clear();
  }

  addAssetEdge(id: AssetEdgeIdentifier) {
    this._selectionId++;
    this._selection.assetEdges.add(id);
  }

  removeAssetEdge(id: AssetEdgeIdentifier) {
    this._selectionId++;
    this._selection.assetEdges.delete(id);
  }

  removeAssetEdges() {
    this._selection.assetEdges.clear();
  }

  selectAll(graph: InspectableGraph) {
    this.deselectAll();
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
