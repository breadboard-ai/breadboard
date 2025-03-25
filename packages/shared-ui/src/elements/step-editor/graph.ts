/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box";
import { calculateBounds } from "./utils/calculate-bounds";
import {
  GraphIdentifier,
  InspectableEdge,
  InspectableNode,
} from "@google-labs/breadboard";
import { GraphNode } from "./graph-node";
import {
  createEmptyGraphSelectionState,
  inspectableEdgeToString,
} from "../../utils/workspace";
import { GraphEdge } from "./graph-edge";
import { GraphSelectionState } from "../../types/types";
import { css, html } from "lit";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { styleMap } from "lit/directives/style-map.js";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { SelectGraphContentsEvent } from "./events/events";

@customElement("bb-graph")
export class Graph extends Box {
  static styles = [
    Box.styles,
    css`
      #graph-boundary {
        position: fixed;
        border: 1px solid var(--bb-ui-300);
        background: oklch(from var(--bb-neutral-0) l c h / 0.25);
        border-radius: var(--bb-grid-size-4);
        transform-origin: 0 0;
        left: 0;
        top: 0;

        & label {
          pointer-events: auto;
          cursor: pointer;
          position: fixed;
          height: var(--bb-grid-size-6);
          display: flex;
          align-items: center;
          left: var(--bb-grid-size-5);
          top: calc(-1 * var(--bb-grid-size-3));
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
          border: 1px solid var(--bb-ui-300);
          border-radius: var(--bb-grid-size-16);
          background: var(--bb-icon-home-repair-service) var(--bb-ui-50) 8px
            center / 20px 20px no-repeat;
          color: var(--bb-ui-900);
          font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
        }
      }
    `,
  ];

  #nodes: InspectableNode[] = [];
  #edges: InspectableEdge[] = [];
  #lastUpdateTime = globalThis.performance.now();

  constructor(public readonly graphId: GraphIdentifier) {
    super();
  }

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

      graphNode.transform.e = x;
      graphNode.transform.f = y;

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

    for (const edge of this.#edges) {
      const id = inspectableEdgeToString(edge);
      const graphEdge = this.entities.get(id) as GraphEdge;
      if (!graphEdge) {
        continue;
      }

      graphEdge.selected = selectionState?.edges.has(id) ?? false;
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

    for (const edge of this.#edges) {
      const id = inspectableEdgeToString(edge);
      const graphEdge = this.entities.get(id) as GraphEdge;
      if (!graphEdge) {
        continue;
      }

      if (graphEdge.selected) {
        selectionState.edges.add(id);
      }
    }

    return selectionState;
  }

  applyTranslationToSelection(x: number, y: number, hasSettled: boolean) {
    if (!this.selectionState) {
      return;
    }

    console.log(this.graphId, this.selectionState.nodes);
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

  #selectContents() {
    for (const entity of this.entities.values()) {
      entity.selected = true;
    }

    this.dispatchEvent(new SelectGraphContentsEvent(this.graphId));
  }

  protected renderSelf() {
    const renderBoundary =
      this.graphId !== MAIN_BOARD_ID && this.nodes.length > 0;

    if (renderBoundary) {
      const boundaryTransform = this.worldTransform.translate(-20, -20);
      const styles: Record<string, string> = {
        transform: `${toCSSMatrix(boundaryTransform)}`,
        width: `${this.bounds.width + 40}px`,
        height: `${this.bounds.height + 40}px`,
      };

      return html`<div id="graph-boundary" style=${styleMap(styles)}>
          <label
            @click=${() => {
              this.#selectContents();
            }}
            >${this.boundsLabel || "Untitled tool"}</label
          >
        </div>
        ${this.renderBounds()}`;
    } else {
      return this.renderBounds();
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
