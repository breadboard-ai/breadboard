/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as PIXI from "pixi.js";
import {
  GraphNodeSelectedEvent,
  GraphNodeDeleteEvent,
  GraphEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphEdgeDetachEvent,
  InputErrorEvent,
  GraphNodeDeselectedEvent,
  GraphNodeDeselectedAllEvent,
  GraphNodesVisualUpdateEvent,
  GraphInitialDrawEvent,
  GraphEntityRemoveEvent,
  StartEvent,
} from "../../events/events.js";
import { GRAPH_OPERATIONS } from "./types.js";
import { Graph } from "./graph.js";
import {
  InspectableEdge,
  InspectableEdgeType,
  InspectableNode,
  InspectableNodePorts,
  InspectablePort,
} from "@google-labs/breadboard";
import { GraphNode } from "./graph-node.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { GraphAssets } from "./graph-assets.js";
import { GraphEdge } from "./graph-edge.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { getGlobalColor } from "./utils.js";
import { GraphMetadata } from "@google-labs/breadboard-schema/graph.js";
import { GraphComment } from "./graph-comment.js";
import { EdgeData } from "../../types/types.js";

const backgroundColor = getGlobalColor("--bb-ui-50");
const selectionBoxBackgroundAlpha = 0.05;
const selectionBoxBackgroundColor = getGlobalColor("--bb-neutral-900");
const selectionBoxBorderColor = getGlobalColor("--bb-neutral-500");
const ADHOC_EDGE_ERROR_MESSAGE =
  "Ad-hoc port names must only contain lowercase alphanumeric characters and '-'";

enum MODE {
  MOVE = "move",
  SELECT = "select",
}

interface GraphOpts {
  url: string;
  subGraphId: string | null;
  showNodeTypeDescriptions: boolean;
  collapseNodesByDefault: boolean;
  ports: Map<string, InspectableNodePorts> | null;
  edges: InspectableEdge[];
  nodes: InspectableNode[];
  metadata: GraphMetadata;
  visible: boolean;
}

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  @property({ reflect: true })
  editable = false;

  @property({ reflect: true })
  invertZoomScrollDirection = false;

  @property({ reflect: true })
  readOnly = false;

  @property({ reflect: true })
  highlightInvalidWires = false;

  @property()
  showPortTooltips = false;

  @state()
  private _portTooltip?: {
    location: PIXI.ObservablePoint;
    port: InspectablePort;
  } = undefined;

  #app = new PIXI.Application();
  #appInitialized = false;

  #graphMask = new PIXI.Graphics();

  #overflowDeleteNode: Ref<HTMLButtonElement> = createRef();
  #overflowMinMaxSingleNode: Ref<HTMLButtonElement> = createRef();
  #overflowMenuRef: Ref<HTMLDivElement> = createRef();
  #overflowMenuGraphNode: GraphNode | null = null;

  #activeGraph: Graph | null = null;
  #edgesForDisambiguation: InspectableEdge[] | null = null;
  #menuLocation: PIXI.ObservablePoint | null = null;
  #edgeSelectMenuRef: Ref<HTMLDivElement> = createRef();
  #edgeCreateMenuRef: Ref<HTMLDivElement> = createRef();
  #autoFocusSelf = false;
  #newEdgeData: {
    from: string;
    to: string;
    portsOut: InspectablePort[] | null;
    portsIn: InspectablePort[] | null;
  } | null = null;

  #mode = MODE.SELECT;
  #padding = 50;
  #container = new PIXI.Container({
    isRenderGroup: true,
  });
  #nodeSelection: PIXI.Graphics | null = null;
  #background: PIXI.TilingSprite | null = null;
  #lastContentRect: DOMRectReadOnly | null = null;
  #resizeObserver = new ResizeObserver((entries) => {
    if ("resize" in this.#app) {
      this.#app.resize();
    }

    if (entries.length < 1) {
      return;
    }

    const { contentRect } = entries[0];
    const delta = new PIXI.Point(0, 0);
    if (this.#lastContentRect) {
      delta.x = (contentRect.width - this.#lastContentRect.width) * 0.5;
      delta.y = (contentRect.height - this.#lastContentRect.height) * 0.5;
    }

    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      // Inform the graph about the content rect so that it can attempt to fit
      // the graph inside of it.
      child.layoutRect = contentRect;

      // Reposition it to retain its center.
      const ratio = 1 / this.#container.scale.x;
      child.position.x += delta.x * ratio;
      child.position.y += delta.y * ratio;
    }

    this.#lastContentRect = contentRect;
  });

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onKeyUpBound = this.#onKeyUp.bind(this);
  #onWheelBound = this.#onWheel.bind(this);

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }

    :host(.moving) {
      cursor: grabbing;
    }

    :host([readonly="true"]) canvas {
      touch-action: manipulation !important;
    }

    canvas {
      display: block;
    }

    #edge-create-disambiguation-menu,
    #edge-select-disambiguation-menu,
    #overflow-menu,
    #port-tooltip {
      z-index: 1000;
      display: none;
      top: 0;
      left: 0;
      position: fixed;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      background: #ffffff;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      overflow: auto;
    }

    #port-tooltip.visible {
      display: block;
    }

    #edge-select-disambiguation-menu.visible,
    #overflow-menu.visible {
      display: grid;
      grid-template-rows: var(--bb-grid-size-11);
    }

    #edge-create-disambiguation-menu.visible {
      display: grid;
      padding: var(--bb-grid-size-2);
      grid-template-columns: 1fr 16px 1fr;
      align-items: center;
    }

    #edge-create-disambiguation-menu #edge-create-from,
    #edge-create-disambiguation-menu #edge-create-to {
      grid-template-rows: var(--bb-grid-size-11);
    }

    #edge-create-disambiguation-menu button,
    #edge-select-disambiguation-menu button {
      display: flex;
      align-items: center;
      background: none;
      margin: 0;
      padding: var(--bb-grid-size-3);
      border: none;
      border-bottom: 1px solid var(--bb-neutral-300);
      text-align: left;
      cursor: pointer;
    }

    #edge-create-disambiguation-menu button {
      width: 100%;
      border-bottom: none;
      border-radius: var(--bb-grid-size-2);
      text-align: center;
    }

    #edge-create-disambiguation-menu button:hover,
    #edge-create-disambiguation-menu button:focus,
    #edge-select-disambiguation-menu button:hover,
    #edge-select-disambiguation-menu button:focus {
      background: var(--bb-neutral-50);
    }

    #edge-create-disambiguation-menu button.selected,
    #edge-create-disambiguation-menu button.selected:hover,
    #edge-create-disambiguation-menu button.selected:focus {
      background: var(--bb-ui-50);
      color: var(--bb-ui-600);
    }

    #edge-create-disambiguation-menu button[disabled] {
      cursor: auto;
    }

    #edge-create-disambiguation-menu .edge-arrow,
    #edge-select-disambiguation-menu button .edge-arrow {
      display: block;
      margin: 0 var(--bb-grid-size-2);
      width: 16px;
      height: 16px;
      background: var(--bb-icon-edge-connector) center center / 16px 16px
        no-repeat;
    }

    #edge-create-disambiguation-menu .edge-arrow {
      margin: 0;
    }

    #edge-create-disambiguation-menu input[type="text"] {
      padding: var(--bb-grid-size);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    #edge-create-disambiguation-menu #confirm {
      background: var(--bb-ui-100) var(--bb-icon-resume-blue) 8px 4px / 16px
        16px no-repeat;
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: calc(var(--bb-grid-size) * 2) 0 var(--bb-grid-size) 0;
      width: auto;
    }

    #overflow-menu button {
      display: flex;
      align-items: center;
      background: none;
      margin: 0;
      padding: var(--bb-grid-size-3);
      border: none;
      border-bottom: 1px solid var(--bb-neutral-300);
      text-align: left;
      cursor: pointer;
    }

    #overflow-menu button:hover,
    #overflow-menu button:focus {
      background: var(--bb-neutral-50);
    }

    #overflow-menu button:last-of-type {
      border: none;
    }

    #overflow-menu button::before {
      content: "";
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size-3);
    }

    #overflow-menu #min-max::before {
      background: var(--bb-icon-minimize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max.minimized::before {
      background: var(--bb-icon-maximize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max::after {
      content: "Minimize node";
    }

    #overflow-menu #min-max.minimized::after {
      content: "Maximize node";
    }

    #overflow-menu #delete-node::before {
      background: var(--bb-icon-delete) center center / 20px 20px no-repeat;
    }
  `;

  constructor(
    private minScale = 0.1,
    private maxScale = 4,
    private zoomFactor = 100
  ) {
    super();

    this.#app.stage.addChild(this.#container);
    this.#app.stage.eventMode = "static";
    this.tabIndex = 0;

    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let tilePosition: PIXI.ObservablePoint | null = null;

    const onStageMove = (evt: PIXI.FederatedPointerEvent) => {
      if (!dragStart || !originalPosition) {
        return;
      }

      this.classList.add("moving");

      const dragPosition = this.#app.stage.toLocal(evt.global);
      const dragDeltaX = dragPosition.x - dragStart.x;
      const dragDeltaY = dragPosition.y - dragStart.y;

      this.#container.x = Math.round(originalPosition.x + dragDeltaX);
      this.#container.y = Math.round(originalPosition.y + dragDeltaY);

      if (!this.#background || !tilePosition) {
        return;
      }
      this.#background.tilePosition.x = tilePosition.x + dragDeltaX;
      this.#background.tilePosition.y = tilePosition.y + dragDeltaY;
    };

    const onDragSelect = (evt: PIXI.FederatedPointerEvent) => {
      if (!dragStart || !originalPosition) {
        return;
      }

      if (!this.#nodeSelection) {
        this.#nodeSelection = new PIXI.Graphics();
      }

      const dragPosition = this.#app.stage.toLocal(evt.global);
      const dragDeltaX = dragPosition.x - dragStart.x;
      const dragDeltaY = dragPosition.y - dragStart.y;

      const x = Math.min(dragStart.x, dragPosition.x);
      const y = Math.min(dragStart.y, dragPosition.y);
      const w = Math.abs(dragDeltaX);
      const h = Math.abs(dragDeltaY);

      this.#app.stage.addChild(this.#nodeSelection);
      this.#nodeSelection.clear();
      this.#nodeSelection.beginPath();
      this.#nodeSelection.rect(x, y, w, h);
      this.#nodeSelection.closePath();
      this.#nodeSelection.stroke({ width: 1, color: selectionBoxBorderColor });
      this.#nodeSelection.fill({
        color: selectionBoxBackgroundColor,
        alpha: selectionBoxBackgroundAlpha,
      });

      for (const graph of this.#container.children) {
        if (!(graph instanceof Graph)) {
          continue;
        }

        graph.selectInRect(new PIXI.Rectangle(x, y, w, h));
      }
    };

    this.#app.stage.addListener(
      "pointerdown",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!evt.isPrimary || this.readOnly) {
          return;
        }

        for (const graph of this.#container.children) {
          if (!(graph instanceof Graph)) {
            continue;
          }

          graph.deselectAllChildren();
        }

        dragStart = this.#app.stage.toLocal(evt.global);
        originalPosition = this.#container.position.clone();

        if (!this.#background) {
          return;
        }
        tilePosition = this.#background.tilePosition.clone();
      }
    );

    this.#app.stage.addListener(
      "pointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!evt.isPrimary || this.readOnly) {
          return;
        }

        if (this.#mode === MODE.MOVE) {
          onStageMove(evt);
          return;
        }

        onDragSelect(evt);
      }
    );

    const onPointerUp = () => {
      dragStart = null;
      originalPosition = null;
      tilePosition = null;

      this.classList.remove("moving");

      if (this.#nodeSelection) {
        this.#nodeSelection.removeFromParent();
        this.#nodeSelection.destroy();
        this.#nodeSelection = null;
      }
    };
    this.#app.stage.addListener("pointerup", onPointerUp);
    this.#app.stage.addListener("pointerupoutside", onPointerUp);

    if (this.readOnly) {
      return;
    }

    const onWheel = (evt: PIXI.FederatedWheelEvent) => {
      if (this.readOnly) {
        this.#app.stage.off("wheel", onWheel);
      }

      if (evt.metaKey || evt.ctrlKey) {
        let delta =
          1 -
          (evt.deltaY / this.zoomFactor) *
            (this.invertZoomScrollDirection ? -1 : 1);
        const newScale = this.#container.scale.x * delta;
        if (newScale < this.minScale || newScale > this.maxScale) {
          delta = 1;
        }

        const pivot = this.#app.stage.toLocal(evt.global);
        const matrix = this.#scaleContainerAroundPoint(delta, pivot);

        if (!this.#background) {
          return;
        }

        this.#background.tileTransform.setFromMatrix(matrix);
      } else {
        this.#container.x -= evt.deltaX;
        this.#container.y -= evt.deltaY;
      }
    };

    this.#app.stage.on("wheel", onWheel);
  }

  #scaleContainerAroundPoint(delta: number, pivot: PIXI.PointData) {
    const m = new PIXI.Matrix();
    m.identity()
      .scale(this.#container.scale.x, this.#container.scale.y)
      .translate(this.#container.x, this.#container.y);

    // Update with the mousewheel position & delta.
    m.translate(-pivot.x, -pivot.y)
      .scale(delta, delta)
      .translate(pivot.x, pivot.y);

    // Ensure that it is always on a square pixel.
    m.tx = Math.round(m.tx);
    m.ty = Math.round(m.ty);

    // Apply back to the container.
    this.#container.setFromMatrix(m);
    return m;
  }

  #notifyGraphOfEdgeSelection(edge: EdgeData) {
    if (!this.#activeGraph) {
      return;
    }

    this.#activeGraph.selectEdge(edge);
    this.#activeGraph = null;
  }

  hideAllGraphs() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.mask = this.#graphMask;
    }
  }

  showAllGraphs() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.mask = null;
    }
  }

  set highlightedNodeId(highlightedNodeId: string | null) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.highlightedNodeId = highlightedNodeId;
    }
  }

  get highlightedNodeId() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      return graph.highlightedNodeId;
    }

    return null;
  }

  createGraph(opts: GraphOpts) {
    const graph = new Graph();
    graph.label = this.#createUrl(opts.url, opts.subGraphId);

    this.addGraph(graph);
    this.updateGraphByUrl(opts.url, opts.subGraphId, opts);
  }

  deleteGraphs() {
    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        return false;
      }

      child.removeFromParent();
      child.destroy();
    }
  }

  updateGraphByUrl(
    url: string,
    subGraphId: string | null,
    opts: Partial<GraphOpts>
  ) {
    const graph = this.#container.children.find(
      (child) => child.label === this.#createUrl(url, subGraphId)
    );

    if (!(graph instanceof Graph)) {
      return false;
    }

    if (opts.showNodeTypeDescriptions !== undefined) {
      graph.showNodeTypeDescriptions = opts.showNodeTypeDescriptions;
    }

    if (opts.showNodeTypeDescriptions !== undefined) {
      graph.showNodeTypeDescriptions = opts.showNodeTypeDescriptions;
    }

    if (opts.collapseNodesByDefault !== undefined) {
      graph.collapseNodesByDefault = opts.collapseNodesByDefault;
    }

    if (opts.ports !== undefined) {
      graph.ports = opts.ports;
    }

    if (opts.edges !== undefined) {
      graph.edges = opts.edges;
    }

    if (opts.nodes !== undefined) {
      graph.nodes = opts.nodes;
    }

    if (opts.metadata !== undefined) {
      graph.comments = opts.metadata.comments || null;
    }

    if (opts.visible !== undefined) {
      if (opts.visible) {
        graph.mask = null;
      } else {
        graph.mask = this.#graphMask;
      }
    }

    graph.readOnly = this.readOnly;
    graph.highlightInvalidWires = this.highlightInvalidWires;

    return true;
  }

  #createUrl(url: string, subGraphId: string | null) {
    return url + (subGraphId ? `#${subGraphId}` : "");
  }

  getGraphs(): Graph[] {
    return this.#container.children.filter(
      (child) => child instanceof Graph
    ) as Graph[];
  }

  #emitSelectionState() {
    this.dispatchEvent(new GraphNodeDeselectedAllEvent());

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      const selectedChildren = graph.getSelectedChildren();
      for (const child of selectedChildren) {
        if (!(child instanceof GraphNode || child instanceof GraphComment)) {
          continue;
        }

        this.dispatchEvent(new GraphNodeSelectedEvent(child.label));
      }
    }
  }

  addGraph(graph: Graph) {
    graph.editable = this.editable;

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE, () => {
      this.#emitGraphNodeVisualInformation(graph);
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODES_MOVED,
      (
        nodes: Array<{
          id: string;
          type: "node" | "comment";
          x: number;
          y: number;
          collapsed: boolean;
        }>
      ) => {
        this.dispatchEvent(new GraphNodesVisualUpdateEvent(nodes));
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_SELECTED, (id: string) => {
      this.dispatchEvent(new GraphNodeSelectedEvent(id));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED, (id: string) => {
      this.dispatchEvent(new GraphNodeDeselectedEvent(id));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED_ALL, () => {
      this.dispatchEvent(new GraphNodeDeselectedAllEvent());
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH, (edge: EdgeData) => {
      this.dispatchEvent(new GraphEdgeAttachEvent(edge));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_EDGE_DETACH, (edge: EdgeData) => {
      this.dispatchEvent(new GraphEdgeDetachEvent(edge));
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE,
      (from: EdgeData, to: EdgeData) => {
        this.dispatchEvent(new GraphNodeEdgeChangeEvent(from, to));
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_AUTOSELECTED_NODES, () => {
      this.#emitSelectionState();
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW, () => {
      this.dispatchEvent(new GraphInitialDrawEvent());
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_DRAW, () => {
      graph.layout();
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_MENU_REQUESTED,
      (graphNode: GraphNode, location: PIXI.ObservablePoint) => {
        if (!this.#overflowMenuRef.value) {
          return;
        }

        const overflowMenu = this.#overflowMenuRef.value;
        overflowMenu.classList.add("visible");
        overflowMenu.style.translate = `${location.x}px ${location.y}px`;

        if (this.#overflowMinMaxSingleNode.value) {
          this.#overflowMinMaxSingleNode.value.classList.toggle(
            "minimized",
            graphNode.collapsed
          );
        }

        this.#overflowMenuGraphNode = graphNode;

        window.addEventListener(
          "pointerdown",
          (evt: Event) => {
            if (!this.#overflowMenuGraphNode) {
              return;
            }

            const [topItem] = evt.composedPath();
            switch (topItem) {
              case this.#overflowMinMaxSingleNode.value: {
                this.#overflowMenuGraphNode.collapsed =
                  !this.#overflowMenuGraphNode.collapsed;
                break;
              }

              case this.#overflowDeleteNode.value: {
                if (!this.#overflowMenuGraphNode.label) {
                  console.warn("Tried to delete unnamed node");
                  break;
                }

                this.dispatchEvent(
                  new GraphNodeDeleteEvent(this.#overflowMenuGraphNode.label)
                );
                break;
              }
            }

            overflowMenu.classList.remove("visible");
            this.#overflowMenuGraphNode = null;
          },
          { once: true }
        );
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_SELECT_DISAMBIGUATION_REQUESTED,
      (possibleEdges: InspectableEdge[], location: PIXI.ObservablePoint) => {
        this.#activeGraph = graph;
        this.#edgesForDisambiguation = possibleEdges;
        this.#menuLocation = location;

        this.requestUpdate();
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_ADD_DISAMBIGUATION_REQUESTED,
      (
        from: string,
        to: string,
        portsOut: InspectablePort[],
        portsIn: InspectablePort[],
        location: PIXI.ObservablePoint
      ) => {
        this.#activeGraph = graph;
        this.#newEdgeData = {
          from,
          to,
          portsOut,
          portsIn,
        };
        this.#menuLocation = location;

        this.requestUpdate();
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_ADD_AD_HOC_DISAMBIGUATION_REQUESTED,
      (
        from: string,
        to: string,
        portsOut: InspectablePort[] | null,
        portsIn: InspectablePort[] | null,
        location: PIXI.ObservablePoint
      ) => {
        this.#activeGraph = graph;
        this.#newEdgeData = {
          from,
          to,
          portsOut,
          portsIn,
        };
        this.#menuLocation = location;

        this.requestUpdate();
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_BOARD_LINK_CLICKED, (board: string) => {
      this.dispatchEvent(new StartEvent(board));
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSEENTER,
      (port: InspectablePort, location: PIXI.ObservablePoint) => {
        this._portTooltip = { port, location };
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSELEAVE, () => {
      this._portTooltip = undefined;
    });

    this.#container.addChild(graph);
  }

  removeGraph(graph: Graph) {
    graph.removeFromParent();
    graph.destroy();
  }

  removeAllGraphs() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      this.removeGraph(graph);
    }
  }

  getSelectedChildren() {
    const selected: Array<GraphNode | GraphComment | GraphEdge> = [];

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      selected.push(...graph.getSelectedChildren());
    }

    return selected;
  }

  deselectAllChildren() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.deselectAllChildren();
    }
  }

  toGlobal(point: PIXI.PointData) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      return graph.toGlobal(point);
    }

    return point;
  }

  setNodeLayoutPosition(
    node: string,
    type: "comment" | "node",
    position: PIXI.PointData,
    collapsed: boolean,
    justAdded: boolean
  ) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      return graph.setNodeLayoutPosition(
        node,
        type,
        position,
        collapsed,
        justAdded
      );
    }

    return null;
  }

  getNodeLayoutPosition(node: string) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      return graph.getNodeLayoutPosition(node);
    }

    return null;
  }

  addToAutoSelect(node: string) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      return graph.addToAutoSelect(node);
    }
  }

  zoomToFit() {
    this.#container.scale.set(1, 1);

    // Find the first graph in the container and size to it.
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      const graphPosition = graph.getGlobalPosition();
      const graphBounds = graph.getBounds();
      const rendererBounds = this.getBoundingClientRect();

      // Dagre isn't guaranteed to start the layout at 0, 0, so we adjust things
      // back here so that the scaling calculations work out.
      graphBounds.x -= graphPosition.x;
      graphBounds.y -= graphPosition.y;
      graph.position.set(-graphBounds.x, -graphBounds.y);
      this.#container.position.set(
        (rendererBounds.width - graphBounds.width) * 0.5,
        (rendererBounds.height - graphBounds.height) * 0.5
      );
      const delta = Math.min(
        (rendererBounds.width - 2 * this.#padding) / graphBounds.width,
        (rendererBounds.height - 2 * this.#padding) / graphBounds.height,
        1
      );

      if (delta < this.minScale) {
        this.minScale = delta;
      }

      const pivot = {
        x: rendererBounds.width / 2,
        y: rendererBounds.height / 2,
      };
      this.#scaleContainerAroundPoint(delta, pivot);
      this.#emitGraphNodeVisualInformation(graph);
      return;
    }
  }

  #emitGraphNodeVisualInformation(graph: Graph) {
    const positions = graph.getNodeLayoutPositions();
    const nodes = [...positions.entries()].map(([id, layout]) => {
      return {
        id,
        type: layout.type,
        x: layout.x,
        y: layout.y,
        collapsed: layout.collapsed,
      };
    });

    this.dispatchEvent(new GraphNodesVisualUpdateEvent(nodes));
  }

  resetGraphLayout() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.clearNodeLayoutPositions();
      graph.layout();

      this.#emitGraphNodeVisualInformation(graph);
    }
  }

  selectAll() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.selectAll();
    }
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.code === "KeyA" && evt.metaKey) {
      if (evt.composedPath()[0] !== this) {
        return;
      }

      this.selectAll();
      return;
    }

    if (evt.code === "Space" && !this.readOnly) {
      this.#mode = MODE.MOVE;
      return;
    }

    if (evt.code !== "Backspace") {
      return;
    }

    const [target] = evt.composedPath();
    if (target !== this) {
      return;
    }

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      const selectedChildren = graph.getSelectedChildren();
      if (!selectedChildren.length) {
        continue;
      }

      const nodes: string[] = [];
      const edges: EdgeData[] = [];
      const comments: string[] = [];
      for (const child of selectedChildren) {
        if (child instanceof GraphNode) {
          nodes.push(child.label);
        } else if (child instanceof GraphComment) {
          comments.push(child.label);
        } else if (child instanceof GraphEdge && child.edge) {
          edges.push(child.edge);
        }
      }

      this.dispatchEvent(new GraphEntityRemoveEvent(nodes, edges, comments));
    }
  }

  #onKeyUp(evt: KeyboardEvent) {
    if (evt.code === "Space" && !this.readOnly) {
      this.#mode = MODE.SELECT;
      return;
    }
  }

  #onWheel(evt: WheelEvent) {
    if (this.readOnly) {
      return;
    }

    evt.preventDefault();
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
    window.addEventListener("keyup", this.#onKeyUpBound);
    window.addEventListener("keydown", this.#onKeyDownBound);
    this.addEventListener("wheel", this.#onWheelBound, { passive: false });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    if ("stop" in this.#app) {
      this.#app.stop();
    }

    this.#resizeObserver.disconnect();
    window.removeEventListener("keyup", this.#onKeyUpBound);
    window.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("wheel", this.#onWheelBound);
  }

  async loadTexturesAndInitializeRenderer() {
    if (this.#appInitialized) {
      return this.#app.canvas;
    }

    await Promise.all([
      GraphAssets.instance().loaded,
      this.#app.init({
        webgpu: {
          background: backgroundColor,
          antialias: true,
        },
        webgl: {
          background: backgroundColor,
          antialias: true,
        },
        preference: "webgl",
        resizeTo: this,
        autoDensity: true,
        resolution: Math.max(2, window.devicePixelRatio),
        eventMode: "static",
        eventFeatures: {
          globalMove: true,
          move: true,
          click: true,
          wheel: true,
        },
      }),
    ]);

    if (!this.#background) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.warn("Unable to create background texture");
        return;
      }
      ctx.fillStyle = `#${backgroundColor.toString(16)}`;
      ctx.fillRect(0, 0, 1, 1);

      const texture = PIXI.Texture.from(canvas);

      this.#background = new PIXI.TilingSprite(texture);
      this.#background.width = this.#app.canvas.width;
      this.#background.height = this.#app.canvas.height;

      this.#app.stage.addChildAt(this.#background, 0);
    } else {
      this.#app.stage.addChildAt(this.#background, 0);
    }

    this.#app.start();
    this.#app.resize();
    this.#app.renderer.addListener("resize", () => {
      if (!this.#background) {
        return;
      }

      this.#background.width = this.#app.renderer.width;
      this.#background.height = this.#app.renderer.height;
    });

    this.#appInitialized = true;
    return this.#app.canvas;
  }

  protected updated(): void {
    if (
      (this.#edgesForDisambiguation && this.#edgeSelectMenuRef.value) ||
      (this.#newEdgeData && this.#edgeCreateMenuRef.value)
    ) {
      window.addEventListener(
        "pointerdown",
        () => {
          this.#edgesForDisambiguation = null;
          this.#newEdgeData = null;
          this.#autoFocusSelf = true;
          this.requestUpdate();
        },
        { once: true }
      );

      const input = this.#edgeCreateMenuRef.value?.querySelector("input");
      if (input) {
        input.focus();
      }
    }

    if (this.#autoFocusSelf) {
      this.#autoFocusSelf = false;
      requestAnimationFrame(() => {
        this.focus();
      });
    }
  }

  #createEdgeIfPossible() {
    if (!this.#edgeCreateMenuRef.value) {
      return false;
    }

    if (!this.#newEdgeData) {
      return false;
    }

    if (!this.#activeGraph) {
      return false;
    }

    const menu = this.#edgeCreateMenuRef.value;
    const lhsButton = menu.querySelector<HTMLButtonElement>(
      "#edge-create-from .selected"
    );
    const lhsInput = menu.querySelector<HTMLInputElement>(
      "#edge-create-from input"
    );
    const rhsButton = menu.querySelector<HTMLButtonElement>(
      "#edge-create-to .selected"
    );
    const rhsInput = menu.querySelector<HTMLInputElement>(
      "#edge-create-to input"
    );

    if (!(lhsButton || lhsInput) || !(rhsButton || rhsInput)) {
      return false;
    }

    let inPortName: string | null = null;
    let outPortName: string | null = null;
    if (lhsButton) {
      outPortName = lhsButton.dataset.portName || null;
    } else if (lhsInput) {
      if (lhsInput.value !== "" && !lhsInput.checkValidity()) {
        const evt = new InputErrorEvent(ADHOC_EDGE_ERROR_MESSAGE);
        this.dispatchEvent(evt);
        return false;
      }

      outPortName = lhsInput.value || null;
    }
    if (rhsButton) {
      inPortName = rhsButton.dataset.portName || null;
    } else if (rhsInput) {
      if (rhsInput.value !== "" && !rhsInput.checkValidity()) {
        const evt = new InputErrorEvent(ADHOC_EDGE_ERROR_MESSAGE);
        this.dispatchEvent(evt);
        return false;
      }

      inPortName = rhsInput.value || null;
    }

    if (!(outPortName && inPortName)) {
      return false;
    }

    const newEdgeDisambiguationInfo = this.#newEdgeData;
    const existingEdge = this.#activeGraph.edges?.find((edge) => {
      return (
        edge.from.descriptor.id === newEdgeDisambiguationInfo.from &&
        edge.to.descriptor.id === newEdgeDisambiguationInfo.to &&
        edge.out === outPortName &&
        edge.in === inPortName
      );
    });

    if (existingEdge) {
      return true;
    }

    // TODO: Support non-ordinary wires here?
    const edge = {
      from: { descriptor: { id: this.#newEdgeData.from } },
      to: { descriptor: { id: this.#newEdgeData.to } },
      out: outPortName,
      in: inPortName,
      type: InspectableEdgeType.Ordinary,
    };

    this.dispatchEvent(new GraphEdgeAttachEvent(edge));

    return true;
  }

  render() {
    const overflowMenu = html`<div
      ${ref(this.#overflowMenuRef)}
      id="overflow-menu"
    >
      <button id="min-max" ${ref(this.#overflowMinMaxSingleNode)}></button>
      ${this.editable
        ? html`<button id="delete-node" ${ref(this.#overflowDeleteNode)}>
            Delete node
          </button>`
        : nothing}
    </div>`;

    const edgeSelectDisambiguationMenuLocation: PIXI.Point =
      this.#menuLocation || new PIXI.Point(0, 0);
    const edgeSelectDisambiguationMenu = html`<div
      ${ref(this.#edgeSelectMenuRef)}
      id="edge-select-disambiguation-menu"
      class=${classMap({ visible: this.#edgesForDisambiguation !== null })}
      style=${styleMap({
        translate: `${edgeSelectDisambiguationMenuLocation.x}px ${edgeSelectDisambiguationMenuLocation.y}px`,
      })}
    >
      ${this.#edgesForDisambiguation
        ? map(this.#edgesForDisambiguation, (edge) => {
            const labelOut = edge.from.ports().then((portInfo) => {
              const port = portInfo.outputs.ports.find(
                (port) => port.name === edge.out
              );
              if (!port) {
                return html`${edge.out}`;
              }

              return html`${port.title ?? port.name}`;
            });

            const labelIn = edge.to.ports().then((portInfo) => {
              const port = portInfo.inputs.ports.find(
                (port) => port.name === edge.in
              );
              if (!port) {
                return html`${edge.out}`;
              }

              return html`${port.title ?? port.name}`;
            });

            return html`<button
              @pointerdown=${() => {
                this.#notifyGraphOfEdgeSelection(edge);
              }}
            >
              ${until(labelOut, html`Out...`)}
              <span class="edge-arrow"></span>
              ${until(labelIn, html`In...`)}
            </button>`;
          })
        : html`No edges require disambiguation`}
    </div>`;

    const menuLocation: PIXI.Point = this.#menuLocation || new PIXI.Point(0, 0);
    const menuRequiresConfirmation =
      this.#newEdgeData &&
      (this.#newEdgeData.portsIn === null ||
        this.#newEdgeData.portsOut === null);

    let suppliedPortInName: string | null = null;
    let suppliedPortOutName: string | null = null;

    if (this.#newEdgeData) {
      const canSupplyInPortName =
        this.#newEdgeData.portsOut !== null &&
        this.#newEdgeData.portsOut.length === 1;
      const canSupplyOutPortName =
        this.#newEdgeData.portsIn !== null &&
        this.#newEdgeData.portsIn.length === 1;

      if (canSupplyInPortName && this.#newEdgeData.portsOut !== null) {
        suppliedPortInName = this.#newEdgeData.portsOut[0].name;
      }

      if (canSupplyOutPortName && this.#newEdgeData.portsIn !== null) {
        suppliedPortOutName = this.#newEdgeData.portsIn[0].name;
      }
    }

    const edgeMenu = this.#newEdgeData
      ? html`<div
          ${ref(this.#edgeCreateMenuRef)}
          id="edge-create-disambiguation-menu"
          class=${classMap({
            visible: this.#newEdgeData !== null,
          })}
          style=${styleMap({
            translate: `${menuLocation.x}px ${menuLocation.y}px`,
          })}
        >
          <div id="edge-create-from">
            ${this.#newEdgeData.portsOut && this.#newEdgeData.portsOut.length
              ? this.#newEdgeData.portsOut.map((port, _idx, ports) => {
                  return html`<button
                    @pointerdown=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLButtonElement)) {
                        return;
                      }

                      evt.target.classList.toggle("selected");
                      if (!this.#createEdgeIfPossible()) {
                        evt.stopImmediatePropagation();
                      }
                    }}
                    ?disabled=${ports.length === 1}
                    class=${classMap({ selected: ports.length === 1 })}
                    data-port-name="${port.name}"
                  >
                    ${port.title ?? port.name}
                  </button>`;
                })
              : this.#newEdgeData.portsOut === null
                ? html`<input
                    @pointerdown=${(evt: Event) => {
                      evt.stopImmediatePropagation();
                    }}
                    @keydown=${(evt: KeyboardEvent) => {
                      evt.stopImmediatePropagation();
                      if (evt.key !== "Enter") {
                        return;
                      }

                      if (!this.#createEdgeIfPossible()) {
                        return;
                      }

                      window.dispatchEvent(new Event("pointerdown"));
                    }}
                    .value=${suppliedPortOutName}
                    type="text"
                    placeholder="Enter port name"
                    required
                    pattern="^[a-z0-9\\-]+$"
                  />`
                : html`No outgoing ports`}
          </div>
          <span class="edge-arrow"></span>
          <div id="edge-create-to">
            ${this.#newEdgeData.portsIn && this.#newEdgeData.portsIn.length
              ? this.#newEdgeData.portsIn.map((port, _idx, ports) => {
                  return html`<button
                    @pointerdown=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLButtonElement)) {
                        return;
                      }

                      evt.target.classList.toggle("selected");
                      if (!this.#createEdgeIfPossible()) {
                        evt.stopImmediatePropagation();
                      }
                    }}
                    ?disabled=${ports.length === 1}
                    class=${classMap({ selected: ports.length === 1 })}
                    data-port-name="${port.name}"
                  >
                    ${port.title ?? port.name}
                  </button>`;
                })
              : this.#newEdgeData.portsIn === null
                ? html`<input
                    @pointerdown=${(evt: Event) => {
                      evt.stopImmediatePropagation();
                    }}
                    @keydown=${(evt: KeyboardEvent) => {
                      evt.stopImmediatePropagation();
                      if (evt.key !== "Enter") {
                        return;
                      }

                      if (!this.#createEdgeIfPossible()) {
                        return;
                      }

                      window.dispatchEvent(new Event("pointerdown"));
                    }}
                    .value=${suppliedPortInName}
                    type="text"
                    placeholder="Enter port name"
                    required
                    pattern="^[a-z0-9\\-]+$"
                  />`
                : html`No incoming ports`}
          </div>
          ${menuRequiresConfirmation
            ? html`<div>
                <button
                  id="confirm"
                  @pointerdown=${(evt: Event) => {
                    if (!(evt.target instanceof HTMLButtonElement)) {
                      return;
                    }

                    if (!this.#createEdgeIfPossible()) {
                      evt.stopImmediatePropagation();
                    }
                  }}
                >
                  Confirm
                </button>
              </div>`
            : nothing}
        </div>`
      : nothing;

    return [
      until(this.loadTexturesAndInitializeRenderer()),
      overflowMenu,
      edgeSelectDisambiguationMenu,
      edgeMenu,
      this.#renderPortTooltip(),
    ];
  }

  #renderPortTooltip() {
    if (!this.showPortTooltips) {
      return;
    }
    const { port, location } = this._portTooltip ?? {};
    return html`<pp-port-tooltip
      id="port-tooltip"
      .port=${port}
      class=${classMap({ visible: port != null })}
      style=${styleMap({
        translate: `${location?.x ?? 0}px ${location?.y ?? 0}px`,
      })}
    ></pp-port-tooltip>`;
  }
}
