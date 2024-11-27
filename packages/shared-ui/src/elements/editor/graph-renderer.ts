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
  GraphNodeEditEvent,
  GraphEdgeValueSelectedEvent,
  GraphNodeActivitySelectedEvent,
  GraphInteractionEvent,
  GraphShowTooltipEvent,
  GraphHideTooltipEvent,
  GraphCommentEditRequestEvent,
  GraphNodeRunRequestEvent,
} from "../../events/events.js";
import {
  ComponentExpansionState,
  GRAPH_OPERATIONS,
  GraphOpts,
} from "./types.js";
import { Graph } from "./graph.js";
import {
  InspectableEdge,
  InspectableEdgeType,
  InspectablePort,
  Schema,
} from "@google-labs/breadboard";
import { GraphNode } from "./graph-node.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { GraphAssets } from "./graph-assets.js";
import { GraphEdge } from "./graph-edge.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { computeNextExpansionState, getGlobalColor } from "./utils.js";
import { GraphComment } from "./graph-comment.js";
import {
  EdgeData,
  TopGraphEdgeInfo,
  TopGraphRunResult,
} from "../../types/types.js";

const backgroundColor = getGlobalColor("--bb-ui-50");
const backgroundGridColor = getGlobalColor("--bb-ui-100");
const backgroundGridAlpha = 0.25;
const selectionBoxBackgroundAlpha = 0.05;
const selectionBoxBackgroundColor = getGlobalColor("--bb-neutral-900");
const selectionBoxBorderColor = getGlobalColor("--bb-neutral-500");
const ADHOC_EDGE_ERROR_MESSAGE =
  "Ad-hoc port names must only contain lowercase alphanumeric characters and '-'";

enum MODE {
  MOVE = "move",
  SELECT = "select",
}

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  @property({ reflect: true })
  invertZoomScrollDirection = false;

  @property({ reflect: true })
  readOnly = false;

  @property({ reflect: true })
  highlightInvalidWires = false;

  @property()
  showPortTooltips = false;

  @property()
  showSubgraphsInline = false;

  @state()
  private _portTooltip?: {
    location: PIXI.ObservablePoint;
    port: InspectablePort;
  } = undefined;

  #app = new PIXI.Application();
  #appInitialized = false;

  #overflowEditNode: Ref<HTMLButtonElement> = createRef();
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
  #padding = 100;
  #container = new PIXI.Container({
    isRenderGroup: true,
  });

  #nodeSelection: PIXI.Graphics | null = null;
  #background: PIXI.TilingSprite | null = null;
  #lastContentRect: DOMRectReadOnly | null = null;
  #resizeObserver = new ResizeObserver((entries) => {
    if (this.#appInitialized && "resize" in this.#app) {
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

    // Reposition the container.
    this.#container.x += delta.x;
    this.#container.y += delta.y;

    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      // Inform the graph about the content rect so that it can attempt to fit
      // the graph inside of it.
      child.layoutRect = contentRect;
    }

    if (this.#background) {
      this.#background.tilePosition.x += delta.x;
      this.#background.tilePosition.y += delta.y;
    }

    this.#lastContentRect = contentRect;
  });

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onKeyUpBound = this.#onKeyUp.bind(this);
  #onWheelBound = this.#onWheel.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);

  ready = this.#loadTexturesAndInitializeRenderer();
  zoomToHighlightedNode = false;

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

    #overflow-menu #min-max.advanced::before {
      background: var(--bb-icon-minimize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max.expanded::before {
      background: var(--bb-icon-maximize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max.collapsed::before {
      background: var(--bb-icon-maximize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max.expanded::after {
      content: "Show advanced ports";
    }

    #overflow-menu #min-max.collapsed::after {
      content: "Show component ports";
    }

    #overflow-menu #min-max.advanced::after {
      content: "Minimize component";
    }

    #overflow-menu #delete-node::before {
      background: var(--bb-icon-delete) center center / 20px 20px no-repeat;
    }

    #overflow-menu #edit-node::before {
      background: var(--bb-icon-edit) center center / 20px 20px no-repeat;
    }
  `;

  constructor(
    private minScale = 0.06,
    private maxScale = 2.5,
    private zoomFactor = 100
  ) {
    super();

    this.#app.stage.addChild(this.#container);
    this.#app.stage.eventMode = "static";
    this.tabIndex = 0;

    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let tilePosition: PIXI.ObservablePoint | null = null;
    let modeWhenInteractionStarted: MODE | null = null;

    const removeNodeSelection = () => {
      if (!this.#nodeSelection) {
        return;
      }

      this.#nodeSelection.removeFromParent();
      this.#nodeSelection.destroy();
      this.#nodeSelection = null;
    };

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
        if (!(graph instanceof Graph) || !graph.visible) {
          continue;
        }

        graph.selectInRect(new PIXI.Rectangle(x, y, w, h));
      }
    };

    const setStartValues = (evt: PIXI.FederatedPointerEvent) => {
      dragStart = this.#app.stage.toLocal(evt.global);
      originalPosition = this.#container.position.clone();
      modeWhenInteractionStarted = this.#mode;

      if (!this.#background) {
        return;
      }
      tilePosition = this.#background.tilePosition.clone();
    };

    const removeStartValues = () => {
      dragStart = null;
      originalPosition = null;
      tilePosition = null;
      modeWhenInteractionStarted = null;
    };

    this.#app.stage.addListener(
      "pointerdown",
      (evt: PIXI.FederatedPointerEvent) => {
        if (evt.nativeEvent.button === 1) {
          this.#mode = MODE.MOVE;
        } else {
          for (const graph of this.#container.children) {
            if (!(graph instanceof Graph) || !graph.visible) {
              continue;
            }

            graph.deselectAllChildren();
          }
        }

        setStartValues(evt);
      }
    );

    this.#app.stage.addListener(
      "pointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        // Reset if the mode changes part way through the interaction.
        if (dragStart && this.#mode !== modeWhenInteractionStarted) {
          setStartValues(evt);
        }

        if (this.#mode === MODE.MOVE) {
          removeNodeSelection();
          onStageMove(evt);
          return;
        }

        onDragSelect(evt);
      }
    );

    const onPointerUp = () => {
      this.#mode = MODE.SELECT;
      this.classList.remove("moving");

      removeNodeSelection();
      removeStartValues();
    };
    this.#app.stage.addListener("pointerup", onPointerUp);
    this.#app.stage.addListener("pointerupoutside", onPointerUp);

    const onWheel = (evt: PIXI.FederatedWheelEvent) => {
      // The user has interacted – stop the auto-zoom/pan.
      this.zoomToHighlightedNode = false;
      this.dispatchEvent(new GraphInteractionEvent());

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

        if (this.#background) {
          this.#background.tilePosition.x -= evt.deltaX;
          this.#background.tilePosition.y -= evt.deltaY;
        }
      }
    };

    this.#app.stage.on("wheel", onWheel);
  }

  get padding() {
    return this.#padding;
  }

  set padding(padding: number) {
    this.#padding = padding;
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

      graph.visible = false;
    }
  }

  showGraph(url: string, subGraphId: string | null) {
    const label = this.#createUrl(url, subGraphId);
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      if (graph.label !== label) {
        continue;
      }

      graph.visible = true;
    }
  }

  set topGraphResult(topGraphResult: TopGraphRunResult | null) {
    let highlightedNode = null;
    let edgeValues = null;
    let nodeInfo = null;

    if (topGraphResult && topGraphResult.currentNode) {
      highlightedNode = topGraphResult.currentNode;
    }

    if (topGraphResult && topGraphResult.edgeValues) {
      edgeValues = topGraphResult.edgeValues;
    }

    if (topGraphResult && topGraphResult.nodeInformation) {
      nodeInfo = topGraphResult.nodeInformation;
    }

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      if (graph.subGraphId) {
        continue;
      }

      graph.highlightedNode = highlightedNode;
      graph.edgeValues = edgeValues;
      graph.nodeInfo = nodeInfo;
    }

    if (!this.zoomToHighlightedNode || !highlightedNode) {
      return;
    }

    this.zoomToNode(highlightedNode.descriptor.id, null, -0.1);
  }

  createGraph(opts: GraphOpts) {
    const graph = new Graph();
    graph.label = this.#createUrl(opts.url, opts.subGraphId);

    this.#addGraph(graph);
    this.updateGraphByUrl(opts.url, opts.subGraphId, opts);
    this.#showBackground();
  }

  deleteGraphs() {
    for (let c = this.#container.children.length; c >= 0; c--) {
      const child = this.#container.children[c];
      if (!(child instanceof Graph)) {
        continue;
      }

      child.removeFromParent();
      child.destroy();
    }

    this.#hideBackground();
  }

  #hideBackground() {
    if (!this.#background) {
      return;
    }

    this.#background.visible = false;
  }

  #showBackground() {
    if (!this.#background) {
      return;
    }

    this.#background.visible = true;
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

    graph.readOnly = this.readOnly;
    graph.highlightInvalidWires = this.highlightInvalidWires;

    if (opts.showNodeTypeDescriptions !== undefined) {
      graph.showNodeTypeDescriptions = opts.showNodeTypeDescriptions;
    }

    if (opts.showNodePreviewValues !== undefined) {
      graph.showNodePreviewValues = opts.showNodePreviewValues;
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

    if (opts.modules !== undefined) {
      graph.modules = opts.modules;
    }

    if (opts.typeMetadata !== undefined) {
      graph.typeMetadata = opts.typeMetadata;
    }

    if (opts.metadata !== undefined) {
      graph.comments = opts.metadata.comments || null;
    }

    if (opts.visible !== undefined) {
      graph.visible = opts.visible;
    }

    graph.subGraphId = subGraphId;
    graph.subGraphTitle = opts.title ?? null;

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
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      const selectedChildren = graph.getSelectedChildren();
      for (const child of selectedChildren) {
        if (!(child instanceof GraphNode || child instanceof GraphComment)) {
          continue;
        }

        this.dispatchEvent(
          new GraphNodeSelectedEvent(child.label, graph.subGraphId)
        );
      }
    }
  }

  #addGraph(graph: Graph) {
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
          expansionState: ComponentExpansionState;
        }>
      ) => {
        this.dispatchEvent(
          new GraphNodesVisualUpdateEvent(nodes, graph.subGraphId)
        );
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_SELECTED, (id: string) => {
      this.dispatchEvent(new GraphNodeSelectedEvent(id, graph.subGraphId));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED, (id: string) => {
      this.dispatchEvent(new GraphNodeDeselectedEvent(id, graph.subGraphId));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED_ALL, () => {
      this.dispatchEvent(new GraphNodeDeselectedAllEvent());
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH, (edge: EdgeData) => {
      this.dispatchEvent(new GraphEdgeAttachEvent(edge, graph.subGraphId));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_EDGE_DETACH, (edge: EdgeData) => {
      this.dispatchEvent(new GraphEdgeDetachEvent(edge, graph.subGraphId));
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE,
      (from: EdgeData, to: EdgeData) => {
        this.dispatchEvent(
          new GraphNodeEdgeChangeEvent(from, to, false, graph.subGraphId)
        );
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_AUTOSELECTED_NODES, () => {
      this.#emitSelectionState();
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW, () => {
      this.dispatchEvent(new GraphInitialDrawEvent(graph.subGraphId));
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
            "expanded",
            graphNode.expansionState === "expanded"
          );
          this.#overflowMinMaxSingleNode.value.classList.toggle(
            "collapsed",
            graphNode.expansionState === "collapsed"
          );
          this.#overflowMinMaxSingleNode.value.classList.toggle(
            "advanced",
            graphNode.expansionState === "advanced"
          );
        }

        this.#overflowMenuGraphNode = graphNode;

        window.addEventListener(
          "pointerdown",
          (evt: PointerEvent) => {
            if (!this.#overflowMenuGraphNode) {
              return;
            }

            const [topItem] = evt.composedPath();
            switch (topItem) {
              case this.#overflowMinMaxSingleNode.value: {
                this.#overflowMenuGraphNode.expansionState =
                  computeNextExpansionState(
                    this.#overflowMenuGraphNode.expansionState
                  );
                break;
              }

              case this.#overflowEditNode.value: {
                if (!this.#overflowMenuGraphNode.label) {
                  console.warn("Tried to delete unnamed node");
                  break;
                }

                this.dispatchEvent(
                  new GraphNodeEditEvent(
                    this.#overflowMenuGraphNode.label,
                    null,
                    null,
                    evt.clientX,
                    evt.clientY,
                    graph.subGraphId,
                    false
                  )
                );
                break;
              }

              case this.#overflowDeleteNode.value: {
                if (!this.#overflowMenuGraphNode.label) {
                  console.warn("Tried to delete unnamed node");
                  break;
                }

                this.dispatchEvent(
                  new GraphNodeDeleteEvent(
                    this.#overflowMenuGraphNode.label,
                    graph.subGraphId
                  )
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

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
      (
        id: string,
        port: InspectablePort | null,
        selectedPort: string | null,
        x: number,
        y: number
      ) => {
        this.dispatchEvent(
          new GraphNodeEditEvent(id, port, selectedPort, x, y, graph.subGraphId)
        );
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_VALUE_SELECTED,
      (
        info: TopGraphEdgeInfo[],
        schema: Schema | null,
        edge: EdgeData | null,
        x: number,
        y: number
      ) => {
        this.dispatchEvent(
          new GraphEdgeValueSelectedEvent(
            info,
            schema,
            edge,
            x,
            y,
            graph.subGraphId
          )
        );
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
      (nodeName: string, id: string) => {
        this.dispatchEvent(new GraphNodeActivitySelectedEvent(nodeName, id));
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP,
      (message: string, x: number, y: number) => {
        this.dispatchEvent(new GraphShowTooltipEvent(message, x, y));
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP, () => {
      this.dispatchEvent(new GraphHideTooltipEvent());
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_COMMENT_EDIT_REQUESTED,
      (id: string, x: number, y: number) => {
        this.dispatchEvent(
          new GraphCommentEditRequestEvent(id, x, y, graph.subGraphId)
        );
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_RUN_REQUESTED, (id: string) => {
      this.dispatchEvent(new GraphNodeRunRequestEvent(id, graph.subGraphId));
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_EDIT,
      (id: string, x: number, y: number) => {
        this.dispatchEvent(
          new GraphNodeEditEvent(id, null, null, x, y, graph.subGraphId, false)
        );
      }
    );

    this.#container.addChild(graph);
  }

  removeGraph(graph: Graph) {
    graph.removeFromParent();
    graph.destroy();
  }

  removeGraphs(keepList: string[]) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      if (keepList.includes(graph.label)) {
        continue;
      }

      // This is a subgraph, so do a further check to ensure whether it should
      // be retained or removed.
      if (graph.label.includes("#")) {
        let keep = false;
        searchLoop: for (const tabURL of keepList) {
          if (graph.label.startsWith(tabURL)) {
            keep = true;
            break searchLoop;
          }
        }

        if (keep) {
          continue;
        }
      }

      this.removeGraph(graph);
    }
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
      if (!(graph instanceof Graph) || !graph.visible) {
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
    subGraphId: string | null = null,
    expansionState: ComponentExpansionState,
    justAdded: boolean
  ) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      if (subGraphId && graph.subGraphId !== subGraphId) {
        continue;
      }

      return graph.setNodeLayoutPosition(
        node,
        type,
        position,
        expansionState,
        justAdded
      );
    }

    return null;
  }

  calculateNodeLocation(x: number, y: number) {
    return this.#container.toGlobal({ x, y });
  }

  getNodeLayoutPosition(node: string) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      return graph.getNodeLayoutPosition(node);
    }

    return null;
  }

  addToAutoSelect(node: string) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      return graph.addToAutoSelect(node);
    }
  }

  zoomToNode(id: string, subGraphId: string | null, offset = 0) {
    this.zoomToFit(0, subGraphId, subGraphId !== null);

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      if (subGraphId && graph.subGraphId !== subGraphId) {
        continue;
      }

      const graphNode = graph.getChildByLabel(id);
      if (!graphNode) {
        continue;
      }

      const graphBounds = graph.getBounds();
      const graphNodeBounds = graphNode.getBounds();
      const rendererBounds = this.getBoundingClientRect();

      const graphMidX =
        (graphBounds.x + graphBounds.width / 2) / rendererBounds.width;
      const graphMidY =
        (graphBounds.y + graphBounds.height / 2) / rendererBounds.height;

      const xShift =
        (graphMidX +
          offset -
          (graphNodeBounds.x - graphBounds.x + graphNodeBounds.width * 0.5) /
            graphBounds.width) *
        graphBounds.width;
      this.#container.x += xShift;

      const yShift =
        (graphMidY -
          (graphNodeBounds.y - graphBounds.y + graphNodeBounds.height * 0.5) /
            graphBounds.height) *
        graphBounds.height;
      this.#container.y += yShift;

      let delta = Math.min(
        (rendererBounds.width - 2 * this.#padding) / graphNodeBounds.width,
        (rendererBounds.height - 2 * this.#padding) / graphNodeBounds.height
      );

      const zoomNodeMaxScale = this.maxScale * 0.5;
      if (delta < this.minScale) {
        delta = this.minScale;
      } else if (delta > zoomNodeMaxScale) {
        delta = zoomNodeMaxScale;
      }

      const pivot = {
        x: rendererBounds.width / 2,
        y: rendererBounds.height / 2,
      };

      const matrix = this.#scaleContainerAroundPoint(delta, pivot);
      if (this.#background) {
        this.#background.tileTransform.setFromMatrix(matrix);
      }
      return;
    }
  }

  zoomToFit(
    reduceRenderBoundsWidth = 0,
    subGraphId: string | null = null,
    includeSubGraphs = true
  ) {
    this.#container.position.set(0, 0);
    this.#container.scale.set(1, 1);

    const bounds = new PIXI.Bounds();
    const position = new PIXI.Point();

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      if (!includeSubGraphs && graph.subGraphId) {
        continue;
      }

      if (subGraphId && graph.subGraphId !== subGraphId) {
        continue;
      }

      const graphPosition = graph.getGlobalPosition();
      position.x = Math.min(position.x, graphPosition.x);
      position.y = Math.min(position.y, graphPosition.y);

      const graphBounds = graph.getBounds();
      bounds.addBounds(graphBounds);
    }

    if (!bounds.isValid) {
      return;
    }

    const rendererBounds = this.getBoundingClientRect();
    if (reduceRenderBoundsWidth) {
      rendererBounds.width -= reduceRenderBoundsWidth;
    }

    // Dagre isn't guaranteed to start the layout at 0, 0, so we adjust things
    // back here so that the scaling calculations work out.
    bounds.x -= position.x;
    bounds.y -= position.y;
    this.#container.position.set(
      -bounds.x + (rendererBounds.width - bounds.width) * 0.5,
      -bounds.y + (rendererBounds.height - bounds.height) * 0.5
    );
    const delta = Math.min(
      (rendererBounds.width - 2 * this.#padding) / bounds.width,
      (rendererBounds.height - 2 * this.#padding) / bounds.height,
      1
    );

    if (delta < this.minScale) {
      this.minScale = delta;
    }

    const pivot = {
      x: rendererBounds.width / 2,
      y: rendererBounds.height / 2,
    };

    const matrix = this.#scaleContainerAroundPoint(delta, pivot);
    if (this.#background) {
      this.#background.tileTransform.setFromMatrix(matrix);
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
        expansionState: layout.expansionState,
      };
    });

    this.dispatchEvent(
      new GraphNodesVisualUpdateEvent(nodes, graph.subGraphId)
    );
  }

  resetGraphLayout() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      graph.clearNodeLayoutPositions();
      graph.storeCommentLayoutPositions();
      graph.layout();

      this.#emitGraphNodeVisualInformation(graph);
    }
  }

  selectAll() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      graph.selectAll();
    }
  }

  #onPointerDown() {
    this.dispatchEvent(new GraphInteractionEvent());
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.code === "KeyA" && evt.metaKey) {
      if (evt.composedPath()[0] !== this) {
        return;
      }

      this.selectAll();
      return;
    }

    if (evt.code === "Space") {
      this.#mode = MODE.MOVE;
      return;
    }

    if (evt.code !== "Backspace" && evt.code !== "Delete") {
      return;
    }

    const [target] = evt.composedPath();
    if (target !== this) {
      return;
    }

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
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

      this.dispatchEvent(
        new GraphEntityRemoveEvent(nodes, edges, comments, graph.subGraphId)
      );
    }
  }

  #onKeyUp(evt: KeyboardEvent) {
    if (evt.code !== "Space") {
      return;
    }

    this.#mode = MODE.SELECT;
  }

  #onWheel(evt: WheelEvent) {
    evt.preventDefault();
  }

  connectedCallback(): void {
    super.connectedCallback();

    if ("start" in this.#app) {
      this.#app.start();
    }

    this.#resizeObserver.observe(this);
    window.addEventListener("pointerdown", this.#onPointerDownBound);
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
    window.removeEventListener("pointerdown", this.#onPointerDownBound);
    window.removeEventListener("keyup", this.#onKeyUpBound);
    window.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("wheel", this.#onWheelBound);
  }

  async #loadTexturesAndInitializeRenderer() {
    if (this.#appInitialized) {
      return this.#app.canvas;
    }

    await Promise.all([
      GraphAssets.instance().loaded,
      this.#app.init({
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
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.warn("Unable to create background texture");
        return;
      }

      // Solid blue background.
      ctx.fillStyle = `#${backgroundColor.toString(16)}`;
      ctx.fillRect(0, 0, 32, 32);

      // Grid.
      ctx.save();
      ctx.strokeStyle = `#${backgroundGridColor.toString(16)}`;
      ctx.beginPath();
      ctx.rect(0.5, 0.5, 32, 32);
      ctx.globalAlpha = backgroundGridAlpha;
      ctx.stroke();
      ctx.closePath();
      ctx.restore();

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

    this.dispatchEvent(
      new GraphEdgeAttachEvent(edge, this.#activeGraph.subGraphId)
    );

    return true;
  }

  render() {
    const overflowMenu = html`<div
      ${ref(this.#overflowMenuRef)}
      id="overflow-menu"
    >
      ${!this.readOnly
        ? html` <button id="edit-node" ${ref(this.#overflowEditNode)}>
            Edit component
          </button>`
        : nothing}
      <button id="min-max" ${ref(this.#overflowMinMaxSingleNode)}></button>
      ${!this.readOnly
        ? html` <button id="delete-node" ${ref(this.#overflowDeleteNode)}>
            Delete component
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
                    pattern="^[a-z\\-_][a-z0-9\\-_]*$"
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
                    pattern="^[a-z\\-_][a-z0-9\\-_]*$"
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
      until(this.ready),
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
    return html`<bb-port-tooltip
      id="port-tooltip"
      .port=${port}
      class=${classMap({ visible: port != null })}
      style=${styleMap({
        translate: `${location?.x ?? 0}px ${location?.y ?? 0}px`,
      })}
    ></bb-port-tooltip>`;
  }
}
