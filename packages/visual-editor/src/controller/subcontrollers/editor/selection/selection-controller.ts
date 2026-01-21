/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphDescriptor,
  InspectableGraph,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

type EdgeIdentifier = `${string}:${string}->${string}:${string}`;

interface Selection {
  nodes: Set<NodeIdentifier>;
  edges: Set<EdgeIdentifier>;
}

export function toEdgeIdentifier(edge: Edge): EdgeIdentifier {
  const edgeIn = edge.out === "*" ? "*" : edge.in;
  return `${edge.from}:${edge.out}->${edge.to}:${edgeIn}`;
}

export class SelectionController extends RootController {
  @field()
  private accessor _selection: Selection = {
    nodes: new Set(),
    edges: new Set(),
  };

  get selection(): Readonly<Selection> {
    return this._selection;
  }

  clear() {
    this.removeNodes();
    this.removeEdges();
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

  selectAll(graph: InspectableGraph | GraphDescriptor) {
    let descriptor = graph;
    if ("raw" in descriptor) {
      descriptor = descriptor.raw();
    }

    this.clear();
    for (const node of descriptor.nodes) {
      this._selection.nodes.add(node.id);
    }

    for (const edge of descriptor.edges) {
      this._selection.edges.add(toEdgeIdentifier(edge));
    }
  }
}
