/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box";
import { calculateBounds } from "./utils/calculate-bounds";
import { InspectableEdge, InspectableNode } from "@google-labs/breadboard";
import { GraphNode } from "./graph-node";
import {
  createEmptyGraphSelectionState,
  inspectableEdgeToString,
} from "../../utils/workspace";
import { GraphEdge } from "./graph-edge";
import { GraphSelectionState } from "../../types/types";

@customElement("bb-graph")
export class Graph extends Box {
  static styles = [Box.styles];

  #nodes: InspectableNode[] = [];
  #edges: InspectableEdge[] = [];
  #lastUpdateTime = globalThis.performance.now();

  @property()
  set nodes(nodes: InspectableNode[]) {
    this.#nodes = nodes;

    this.#lastUpdateTime = globalThis.performance.now();

    // Add new nodes.
    for (const node of this.#nodes) {
      let graphNode = this.entities.get(node.descriptor.id) as GraphNode;
      if (!graphNode) {
        graphNode = new GraphNode(node.descriptor.id);
        this.entities.set(node.descriptor.id, graphNode);
      }

      const visual = (node.metadata().visual ?? {}) as Record<string, number>;
      const x = visual?.x ?? 0;
      const y = visual?.y ?? 0;

      graphNode.updating = node.type().currentMetadata().updating ?? false;
      graphNode.nodeTitle = node.title();

      const lastUpdateTime = this.#lastUpdateTime;
      Promise.all([node.describe(), node.type().metadata()]).then(
        ([, metadata]) => {
          // Ensure the most recent values before proceeding.
          if (lastUpdateTime !== this.#lastUpdateTime) {
            return;
          }

          const ports = node.currentPorts();
          if (ports.updating) {
            console.warn(
              "Ports are still updating after describer has completed"
            );
          }

          graphNode.updating = metadata.updating ?? false;
          graphNode.icon = metadata.icon ?? null;
          graphNode.ports = ports;

          if (metadata.tags) {
            for (const tag of metadata.tags ?? []) {
              graphNode.classList.add(tag);
            }
          }

          // Ignore URL types as they should be resolved above.
          const legacyNodeType = node.type().type();
          if (!URL.canParse(legacyNodeType)) {
            if (!graphNode.icon) {
              graphNode.icon = legacyNodeType;
            }

            if (legacyNodeType.startsWith("#module")) {
              graphNode.classList.add("module");
            } else {
              graphNode.classList.add(legacyNodeType);
            }
          }
        }
      );

      graphNode.transform.translateSelf(x, y);
      graphNode.showBounds = this.showBounds;
      graphNode.boundsLabel = node.title();
    }

    // Remove stale nodes.
    for (const [id, entity] of this.entities) {
      if (!(entity instanceof GraphNode)) {
        continue;
      }

      if (nodes.find((node) => node.descriptor.id === id)) {
        continue;
      }

      this.entities.delete(id);
    }
  }
  get nodes() {
    return this.#nodes;
  }

  @property()
  set edges(edges: InspectableEdge[]) {
    this.#edges = edges;

    // Add new edges.
    for (const edge of this.#edges) {
      const label = inspectableEdgeToString(edge);
      let graphEdge = this.entities.get(label) as GraphEdge;
      if (!graphEdge) {
        const from = this.entities.get(edge.from.descriptor.id) as GraphNode;
        const to = this.entities.get(edge.to.descriptor.id) as GraphNode;
        if (!from || !to) {
          console.warn(`Edge declared for non-existent nodes ${label}`);
        }

        graphEdge = new GraphEdge(from, to);
        graphEdge.boundsLabel = label;
        this.entities.set(label, graphEdge);
      }
    }

    // Remove stale edges.
    for (const [id, entity] of this.entities) {
      if (!(entity instanceof GraphEdge)) {
        continue;
      }

      if (edges.find((edge) => inspectableEdgeToString(edge) === id)) {
        continue;
      }

      this.entities.delete(id);
    }
  }
  get edges() {
    return this.#edges;
  }

  @property()
  set selectionState(selectionState: GraphSelectionState | null) {
    for (const node of this.#nodes) {
      const graphNode = this.entities.get(node.descriptor.id) as GraphNode;
      if (!graphNode) {
        continue;
      }

      graphNode.selected =
        selectionState?.nodes.has(node.descriptor.id) ?? false;
    }
  }
  get selectionState() {
    const selectionState = createEmptyGraphSelectionState();
    for (const node of this.#nodes) {
      const graphNode = this.entities.get(node.descriptor.id) as GraphNode;
      if (!graphNode) {
        continue;
      }

      if (graphNode.selected) {
        selectionState.nodes.add(node.descriptor.id);
      }
    }

    return selectionState;
  }

  applyTranslationToSelection(x: number, y: number, hasSettled: boolean) {
    if (!this.selectionState) {
      return;
    }

    for (const node of this.selectionState.nodes) {
      const graphNode = this.entities.get(node) as GraphNode;
      if (!graphNode) {
        continue;
      }

      if (!graphNode.baseTransform) {
        graphNode.baseTransform = DOMMatrix.fromMatrix(graphNode.transform);
      }

      graphNode.transform.e = graphNode.baseTransform.e + x;
      graphNode.transform.f = graphNode.baseTransform.f + y;

      if (hasSettled) {
        graphNode.baseTransform = null;
      }
    }
  }

  calculateLocalBounds(): DOMRect {
    const adjustment = new DOMPoint(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY
    );

    const bounds = calculateBounds(this.entities, adjustment);
    if (Number.isNaN(bounds.left)) {
      return new DOMRect();
    }

    this.adjustTranslation(adjustment.x, adjustment.y);
    for (const entity of this.entities.values()) {
      entity.adjustTranslation(-adjustment.x, -adjustment.y);
    }

    return new DOMRect(0, 0, bounds.width, bounds.height);
  }
}
