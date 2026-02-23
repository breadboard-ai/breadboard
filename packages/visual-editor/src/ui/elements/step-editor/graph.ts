/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box.js";
import { calculateBounds } from "./utils/calculate-bounds.js";
import {
  GraphIdentifier,
  InspectableAsset,
  InspectableAssetEdge,
  InspectableEdge,
  InspectableNode,
  Outcome,
} from "@breadboard-ai/types";
import { GraphNode } from "./graph-node.js";
import {
  createEmptyGraphHighlightState,
  createEmptyGraphSelectionState,
  inspectableEdgeToString,
} from "../../../utils/graph-utils.js";
import { GraphEdge } from "./graph-edge.js";
import {
  EdgeAttachmentPoint,
  GraphHighlightState,
  GraphSelectionState,
} from "../../types/types.js";
import { css, html } from "lit";
import { toCSSMatrix } from "./utils/to-css-matrix.js";
import { styleMap } from "lit/directives/style-map.js";
import { MAIN_BOARD_ID } from "../../../sca/constants.js";
import {
  SelectGraphContentsEvent,
  SelectionTranslateEvent,
} from "./events/events.js";
import { OverflowMenuActionEvent } from "../../events/events.js";
import { toGridSize } from "./utils/to-grid-size.js";
import { GRID_SIZE, MOVE_GRAPH_ID } from "./constants.js";
import { GraphAsset } from "./graph-asset.js";
import { AssetPath, NodeRunState } from "@breadboard-ai/types";
import type {
  RendererRunState,
  GraphAsset as GraphAssetState,
} from "../../../sca/types.js";
import { getStepIcon } from "../../utils/get-step-icon.js";
import { toAssetEdgeIdentifier } from "../../../sca/utils/helpers/helpers.js";

@customElement("bb-graph")
export class Graph extends Box {
  @property({ reflect: true, type: Boolean })
  accessor showGhosted = false;

  @property()
  accessor allowEdgeAttachmentMove = false;

  @property()
  accessor highlightType: "user" | "model" = "user";

  @property()
  accessor url: URL | null = null;

  @property()
  accessor graphAssets: Map<AssetPath, GraphAssetState> | null = null;

  static styles = [
    Box.styles,
    css`
      :host([showghosted]) {
        opacity: 0.5;
      }

      #graph-boundary {
        position: fixed;
        border: 1px solid var(--light-dark-p-80);
        background: oklch(from var(--light-dark-n-100) l c h / 0.25);
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
          border: 1px solid var(--light-dark-p-80);
          border-radius: var(--bb-grid-size-16);
          background: var(--bb-icon-home-repair-service) var(--light-dark-p-98)
            8px center / 20px 20px no-repeat;
          color: var(--light-dark-p-10);
          font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
        }
      }
    `,
  ];

  #nodes: InspectableNode[] = [];
  #edges: InspectableEdge[] = [];
  #assets: Map<AssetPath, InspectableAsset> = new Map();
  #assetEdges: Outcome<InspectableAssetEdge[]> = [];
  #lastUpdateTimes: Map<"nodes" | "assets", number> = new Map();
  #translateStart: DOMPoint | null = null;
  #dragStart: DOMPoint | null = null;

  constructor(public readonly graphId: GraphIdentifier) {
    super();

    if (graphId === MOVE_GRAPH_ID) {
      this.showGhosted = true;
    }
  }

  @property()
  set nodes(nodes: InspectableNode[]) {
    this.#nodes = nodes;

    this.#lastUpdateTimes.set("nodes", globalThis.performance.now());

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

      graphNode.ownerGraph = this.graphId;
      graphNode.updating = node.type().currentMetadata().updating ?? false;
      graphNode.nodeTitle = node.title();
      graphNode.nodeDescription = node.descriptor.metadata?.step_intent || "";

      graphNode.isStart = node.isStart();

      const lastUpdateTime = this.#lastUpdateTimes.get("nodes") ?? 0;

      node.describe().then((_) => {
        // Ensure the most recent values before proceeding.
        if (lastUpdateTime !== this.#lastUpdateTimes.get("nodes")) {
          return;
        }

        const ports = node.currentPorts();
        const metadata = node.type().currentMetadata();

        graphNode.updating = ports.updating ?? false;
        graphNode.ports = ports;
        graphNode.icon = getStepIcon(metadata.icon, ports) || null;

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
      });

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
      const edgeId = inspectableEdgeToString(edge);
      let graphEdge = this.entities.get(edgeId) as GraphEdge;
      if (!graphEdge) {
        const from = this.entities.get(edge.from.descriptor.id) as GraphNode;
        const to = this.entities.get(edge.to.descriptor.id) as GraphNode;
        if (!from || !to) {
          console.warn(`Edge declared for non-existent nodes ${edgeId}`);
        }

        graphEdge = new GraphEdge(from, to, edge, "node");
        graphEdge.boundsLabel = edgeId;
        this.entities.set(edgeId, graphEdge);
      }

      const visual = (edge.metadata()?.visual ?? {}) as Record<
        "from" | "to",
        EdgeAttachmentPoint
      >;
      graphEdge.from = visual.from ?? "Auto";
      graphEdge.to = visual.to ?? "Auto";

      // TODO: figure out how this should be set.
      // graphEdge.carriesList = true;
    }

    // Remove stale edges.
    for (const [id, entity] of this.entities) {
      if (!(entity instanceof GraphEdge)) {
        continue;
      }

      if (entity.edgeType !== "node") {
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
  set assetEdges(assetEdges: Outcome<InspectableAssetEdge[]>) {
    this.#assetEdges = assetEdges;

    if (!Array.isArray(assetEdges)) {
      console.warn(assetEdges.$error);
      return;
    }

    // Add new edges.
    for (const edge of assetEdges) {
      const edgeId = toAssetEdgeIdentifier(edge);
      let graphEdge = this.entities.get(edgeId) as GraphEdge;
      if (!graphEdge) {
        const from = this.entities.get(edge.assetPath) as GraphAsset;
        const to = this.entities.get(edge.node.descriptor.id) as GraphNode;
        if (!from || !to) {
          console.warn(`Edge declared for non-existent nodes ${edgeId}`);
        }

        graphEdge = new GraphEdge(from, to, edge, "asset");
        graphEdge.boundsLabel = edgeId;
        this.entities.set(edgeId, graphEdge);
      }

      // TODO: Update asset edge attachment points.
    }

    // Remove stale edges.
    for (const [id, entity] of this.entities) {
      if (!(entity instanceof GraphEdge)) {
        continue;
      }

      if (entity.edgeType !== "asset") {
        continue;
      }

      if (assetEdges.find((edge) => toAssetEdgeIdentifier(edge) === id)) {
        continue;
      }

      this.entities.delete(id);
    }
  }
  get assetEdges() {
    return this.#assetEdges;
  }

  @property()
  set assets(assets: Map<AssetPath, InspectableAsset>) {
    this.#assets = assets;

    // Add new assets.
    for (const [assetPath, asset] of this.#assets) {
      let graphAsset = this.entities.get(assetPath) as GraphAsset;
      if (!graphAsset) {
        graphAsset = new GraphAsset(assetPath);
        this.entities.set(assetPath, graphAsset);
      }

      const visual = (asset.visual ?? {}) as Record<string, number>;
      const x = visual?.x ?? 0;
      const y = visual?.y ?? 0;

      graphAsset.assetTitle = asset.title;
      graphAsset.asset = asset;
      graphAsset.graphUrl = this.url;
      graphAsset.ownerGraph = this.graphId;
      graphAsset.transform.e = x;
      graphAsset.transform.f = y;

      graphAsset.showBounds = this.showBounds;
      graphAsset.boundsLabel = asset.title;
      graphAsset.state = this.graphAssets?.get(assetPath) || null;
    }

    // Remove stale assets.
    for (const [id, entity] of this.entities) {
      if (!(entity instanceof GraphAsset)) {
        continue;
      }

      if (assets.has(id)) {
        continue;
      }

      this.entities.delete(id);
    }
  }
  get assets() {
    return this.#assets;
  }

  @property()
  set selectionState(selectionState: GraphSelectionState | null) {
    const showEdgePointSelectors =
      selectionState?.nodes.size === 0 && selectionState.edges.size === 1;
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
      graphEdge.showEdgePointSelectors =
        this.allowEdgeAttachmentMove &&
        showEdgePointSelectors &&
        graphEdge.selected;
    }

    if (Array.isArray(this.#assetEdges)) {
      for (const assetEdge of this.#assetEdges) {
        const id = toAssetEdgeIdentifier(assetEdge);
        const graphAssetEdge = this.entities.get(id) as GraphEdge;
        if (!graphAssetEdge) {
          continue;
        }

        graphAssetEdge.selected = selectionState?.assetEdges.has(id) ?? false;
      }
    }

    for (const assetPath of this.#assets.keys()) {
      const graphAsset = this.entities.get(assetPath) as GraphAsset;
      if (!graphAsset) {
        continue;
      }

      graphAsset.selected = selectionState?.assets.has(assetPath) ?? false;
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

    for (const assetPath of this.#assets.keys()) {
      const graphAsset = this.entities.get(assetPath) as GraphAsset;
      if (!graphAsset) {
        continue;
      }

      if (graphAsset.selected) {
        selectionState.assets.add(assetPath);
      }
    }

    if (Array.isArray(this.#assetEdges)) {
      for (const assetEdge of this.#assetEdges) {
        const id = toAssetEdgeIdentifier(assetEdge);
        const graphAssetEdge = this.entities.get(id) as GraphEdge;
        if (!graphAssetEdge) {
          continue;
        }

        if (graphAssetEdge.selected) {
          selectionState.assetEdges.add(id);
        }
      }
    }

    return selectionState;
  }

  @property()
  set highlightState(highlightState: GraphHighlightState | null) {
    for (const node of this.#nodes) {
      const graphNode = this.entities.get(node.descriptor.id) as GraphNode;
      if (!graphNode) {
        continue;
      }

      graphNode.highlightType = this.highlightType;
      graphNode.highlighted =
        highlightState?.nodes.has(node.descriptor.id) ?? false;
    }

    for (const edge of this.#edges) {
      const id = inspectableEdgeToString(edge);
      const graphEdge = this.entities.get(id) as GraphEdge;
      if (!graphEdge) {
        continue;
      }

      graphEdge.highlightType = this.highlightType;
      graphEdge.highlighted = highlightState?.edges.has(id) ?? false;
    }
  }
  get highlightState() {
    const highlightState = createEmptyGraphHighlightState();
    for (const node of this.#nodes) {
      const graphNode = this.entities.get(node.descriptor.id) as GraphNode;
      if (!graphNode) {
        continue;
      }

      if (graphNode.highlighted) {
        highlightState.nodes.add(node.descriptor.id);
      }
    }

    for (const edge of this.#edges) {
      const id = inspectableEdgeToString(edge);
      const graphEdge = this.entities.get(id) as GraphEdge;
      if (!graphEdge) {
        continue;
      }

      if (graphEdge.highlighted) {
        highlightState.edges.add(id);
      }
    }

    return highlightState;
  }

  applyTranslationToSelection(x: number, y: number, hasSettled: boolean) {
    if (!this.selectionState) {
      return;
    }

    const hasMoved = x !== 0 || y !== 0;

    for (const node of this.selectionState.nodes) {
      const graphNode = this.entities.get(node) as GraphNode;
      if (!graphNode || graphNode.readOnly) {
        continue;
      }

      if (!graphNode.baseTransform) {
        graphNode.baseTransform = DOMMatrix.fromMatrix(graphNode.transform);
      }

      graphNode.transform.e = graphNode.baseTransform.e + x;
      graphNode.transform.f = graphNode.baseTransform.f + y;

      if (hasMoved) {
        graphNode.transform.e =
          Math.round(graphNode.transform.e / GRID_SIZE) * GRID_SIZE;
        graphNode.transform.f =
          Math.round(graphNode.transform.f / GRID_SIZE) * GRID_SIZE;
      }

      if (hasSettled) {
        graphNode.baseTransform = null;
      }
    }

    for (const assetPath of this.selectionState.assets) {
      const graphAsset = this.entities.get(assetPath) as GraphAsset;
      if (!graphAsset || graphAsset.readOnly) {
        continue;
      }

      if (!graphAsset.baseTransform) {
        graphAsset.baseTransform = DOMMatrix.fromMatrix(graphAsset.transform);
      }

      graphAsset.transform.e = graphAsset.baseTransform.e + x;
      graphAsset.transform.f = graphAsset.baseTransform.f + y;

      if (hasMoved) {
        graphAsset.transform.e =
          Math.round(graphAsset.transform.e / GRID_SIZE) * GRID_SIZE;
        graphAsset.transform.f =
          Math.round(graphAsset.transform.f / GRID_SIZE) * GRID_SIZE;
      }

      if (hasSettled) {
        graphAsset.baseTransform = null;
      }
    }
  }

  applyTranslationToNodes(x: number, y: number, hasSettled: boolean) {
    for (const node of this.#nodes) {
      const graphNode = this.entities.get(node.descriptor.id) as GraphNode;
      if (!graphNode || graphNode.readOnly) {
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

    for (const assetPath of this.#assets.keys()) {
      const graphAsset = this.entities.get(assetPath) as GraphAsset;
      if (!graphAsset || graphAsset.readOnly) {
        continue;
      }

      if (!graphAsset.baseTransform) {
        graphAsset.baseTransform = DOMMatrix.fromMatrix(graphAsset.transform);
      }

      graphAsset.transform.e = graphAsset.baseTransform.e + x;
      graphAsset.transform.f = graphAsset.baseTransform.f + y;

      if (hasSettled) {
        graphAsset.baseTransform = null;
      }
    }
  }

  #selectContents() {
    for (const entity of this.entities.values()) {
      entity.selected = true;
    }

    this.dispatchEvent(new SelectGraphContentsEvent(this.graphId));
  }

  expandSelections() {
    for (const entity of this.entities.values()) {
      if (entity instanceof GraphNode) {
        if (entity.selected) {
          const nodeEdges = this.#edges.filter(
            (edge) =>
              edge.from.descriptor.id === entity.nodeId ||
              edge.to.descriptor.id === entity.nodeId
          );

          for (const edge of nodeEdges) {
            const graphEdge = this.entities.get(inspectableEdgeToString(edge));
            if (!graphEdge) {
              continue;
            }

            graphEdge.selected = true;
          }
        }
      }
    }
  }

  protected renderSelf() {
    const renderBoundary =
      this.graphId !== MAIN_BOARD_ID &&
      this.graphId !== MOVE_GRAPH_ID &&
      this.nodes.length > 0;

    if (renderBoundary) {
      const boundaryTransform = this.worldTransform.translate(-20, -20);
      const styles: Record<string, string> = {
        transform: `${toCSSMatrix(boundaryTransform, this.force2D)}`,
        width: `${this.bounds.width + 40}px`,
        height: `${this.bounds.height + 40}px`,
      };

      return html`<div id="graph-boundary" style=${styleMap(styles)}>
          <label
            @pointerdown=${(evt: PointerEvent) => {
              evt.stopImmediatePropagation();
              this.#selectContents();

              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              evt.target.setPointerCapture(evt.pointerId);
              this.#dragStart = new DOMPoint();
              this.#dragStart.x = evt.clientX;
              this.#dragStart.y = evt.clientY;

              this.#translateStart = new DOMPoint(
                this.transform.e,
                this.transform.f
              );
            }}
            @pointermove=${(evt: PointerEvent) => {
              if (!this.#translateStart || !this.#dragStart) {
                return;
              }

              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              const dragPosition = new DOMPoint(evt.clientX, evt.clientY);
              const deltaX =
                (dragPosition.x - this.#dragStart.x) / this.worldTransform.a;
              const deltaY =
                (dragPosition.y - this.#dragStart.y) / this.worldTransform.a;

              const xTranslation = toGridSize(deltaX);
              const yTranslation = toGridSize(deltaY);

              this.dispatchEvent(
                new SelectionTranslateEvent(xTranslation, yTranslation)
              );
            }}
            @pointerup=${(evt: PointerEvent) => {
              if (!this.#translateStart || !this.#dragStart) {
                return;
              }

              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              evt.target.releasePointerCapture(evt.pointerId);

              const dragPosition = new DOMPoint(evt.clientX, evt.clientY);
              const deltaX =
                (dragPosition.x - this.#dragStart.x) / this.worldTransform.a;
              const deltaY =
                (dragPosition.y - this.#dragStart.y) / this.worldTransform.a;

              const xTranslation = toGridSize(deltaX);
              const yTranslation = toGridSize(deltaY);

              this.#dragStart = null;
              this.#translateStart = null;

              this.dispatchEvent(
                new SelectionTranslateEvent(
                  xTranslation,
                  yTranslation,
                  /** hasSettled */ true
                )
              );
            }}
            @dblclick=${(evt: PointerEvent) => {
              this.dispatchEvent(
                new OverflowMenuActionEvent(
                  "edit-board-details",
                  this.graphId,
                  evt.clientX,
                  evt.clientY
                )
              );
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

  highlightActivity(runState: RendererRunState | null) {
    for (const node of this.#nodes) {
      const id = node.descriptor.id;
      const graphNode = this.entities.get(id) as GraphNode;
      if (!graphNode) {
        continue;
      }

      if (runState) {
        const nodeRunState: NodeRunState = runState.nodes.get(id) || {
          status: "inactive",
        };

        graphNode.runState = nodeRunState;

        switch (nodeRunState.status) {
          case "failed":
            graphNode.active = "error";
            break;
          case "waiting":
          case "working":
            graphNode.active = "current";
            break;
          case "inactive":
            graphNode.active = "post";
            break;
          default:
            graphNode.active = "pre";
        }
      }
    }

    for (const edge of this.#edges) {
      const edgeId = inspectableEdgeToString(edge);
      const graphEdge = this.entities.get(edgeId) as GraphEdge;
      if (!graphEdge) {
        continue;
      }

      if (runState) {
        graphEdge.status = runState.edges?.get(edgeId)?.status ?? null;
      }
    }
  }
}
