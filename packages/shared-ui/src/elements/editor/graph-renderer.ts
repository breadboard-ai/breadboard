/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as PIXI from "pixi.js";
import {
  GraphNodeDeleteEvent,
  GraphEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphEdgeDetachEvent,
  InputErrorEvent,
  GraphInitialDrawEvent,
  StartEvent,
  GraphNodeEditEvent,
  GraphEdgeValueSelectedEvent,
  GraphNodeActivitySelectedEvent,
  GraphInteractionEvent,
  GraphShowTooltipEvent,
  GraphHideTooltipEvent,
  GraphCommentEditRequestEvent,
  GraphNodeRunRequestEvent,
  WorkspaceSelectionStateEvent,
  WorkspaceVisualUpdateEvent,
  DragConnectorStartEvent,
  ToastEvent,
  ToastType,
  WorkspaceSelectionMoveEvent,
} from "../../events/events.js";
import {
  GRAPH_OPERATIONS,
  GraphNodeReferences,
  GraphOpts,
  GraphReferences,
  MoveToSelection,
} from "./types.js";
import { Graph } from "./graph.js";
import {
  GraphIdentifier,
  InspectableEdge,
  InspectableEdgeType,
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  InspectablePort,
  NodeHandlerMetadata,
  NodeIdentifier,
  PortIdentifier,
  Schema,
} from "@google-labs/breadboard";
import { GraphNode } from "./graph-node.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { GraphAssets } from "./graph-assets.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  computeNextExpansionState,
  emptySelectionState,
  emptyWorkspaceSelectionState,
  getGlobalColor,
  inspectableEdgeToString,
} from "./utils.js";
import {
  EdgeData,
  GraphSelectionState,
  TopGraphEdgeInfo,
  TopGraphRunResult,
  WorkspaceSelectionState,
  WorkspaceSelectionChangeId,
  WorkspaceVisualState,
  WorkspaceVisualChangeId,
  GraphVisualState,
  WorkspaceSelectionStateWithChangeId,
  ReferenceIdentifier,
} from "../../types/types.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import { GraphComment } from "./graph-comment.js";
import { isBoardArrayBehavior, isBoardBehavior } from "../../utils/index.js";
import { CommentNode, ModuleIdentifier } from "@breadboard-ai/types";

const backgroundColor = getGlobalColor("--bb-ui-50");
const backgroundGridColor = getGlobalColor("--bb-ui-100");
const backgroundGridAlpha = 0.25;
const selectionBoxBackgroundAlpha = 0.05;
const selectionBoxBackgroundColor = getGlobalColor("--bb-neutral-900");
const selectionBoxBorderColor = getGlobalColor("--bb-neutral-500");
const ADHOC_EDGE_ERROR_MESSAGE =
  "Ad-hoc port names must only contain lowercase alphanumeric characters and '-'";
const GRAPH_HIDDEN_ALPHA = 0.0001;

enum MODE {
  MOVE = "move",
  SELECT = "select",
}

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

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

  @property()
  assetPrefix = "";

  @property()
  configs: Map<GraphIdentifier, GraphOpts> | null = null;

  @property()
  topGraphResult: TopGraphRunResult | null = null;

  @property()
  selectionChangeId: WorkspaceSelectionChangeId | null = null;

  @property()
  graphTopologyUpdateId: number = 0;

  @property()
  moveToSelection: WorkspaceSelectionStateWithChangeId["moveToSelection"] =
    false;

  @property()
  topGraphUrl: string | null = null;

  @state()
  private _portTooltip?: {
    location: PIXI.ObservablePoint;
    port: InspectablePort;
  } = undefined;

  @property()
  padding = 30;

  @property()
  set showBoardReferenceMarkers(showBoardReferenceMarkers: boolean) {
    this.#showBoardReferenceMarkers = showBoardReferenceMarkers;
    this.#toggleToolBoardMarkersOnGraphs();
  }

  get showBoardReferenceMarkers() {
    return this.#showBoardReferenceMarkers;
  }

  #app = new PIXI.Application();
  #appInitialized = false;
  #configChanged = false;
  #lastSelectionChangeId: WorkspaceSelectionChangeId | null = null;
  #selectionHasChanged = false;
  #topGraphUrlChanged = false;
  #graphsRendered = false;
  #showBoardReferenceMarkers = false;

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
  #container = new PIXI.Container();

  #moveCloneGraph: Graph | null = null;

  #graphItemSelectionRect: PIXI.Graphics | null = null;
  #background: PIXI.TilingSprite | null = null;
  #lastContentRect: DOMRectReadOnly | null = null;
  #resizeObserver = new ResizeObserver((entries) => {
    if (this.#appInitialized && "resize" in this.#app) {
      this.#app.resize();
    }

    if (entries.length < 1) {
      return;
    }

    this.#removeEffect("container");

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

  ready: Promise<HTMLCanvasElement | undefined> | null = null;
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

    this.#container.position.set(0, 0);
    this.#container.scale.set(1, 1);

    this.#app.stage.addChild(this.#container);
    this.#app.stage.eventMode = "static";
    this.tabIndex = 0;

    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let tilePosition: PIXI.ObservablePoint | null = null;
    let modeWhenInteractionStarted: MODE | null = null;

    const removeNodeSelection = () => {
      if (!this.#graphItemSelectionRect) {
        return;
      }

      this.#graphItemSelectionRect.removeFromParent();
      this.#graphItemSelectionRect.destroy({ children: true });
      this.#graphItemSelectionRect = null;
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

      if (!this.#graphItemSelectionRect) {
        this.#graphItemSelectionRect = new PIXI.Graphics();
      }

      const dragPosition = this.#app.stage.toLocal(evt.global);
      const dragDeltaX = dragPosition.x - dragStart.x;
      const dragDeltaY = dragPosition.y - dragStart.y;

      const x = Math.min(dragStart.x, dragPosition.x);
      const y = Math.min(dragStart.y, dragPosition.y);
      const w = Math.abs(dragDeltaX);
      const h = Math.abs(dragDeltaY);

      this.#app.stage.addChild(this.#graphItemSelectionRect);
      this.#graphItemSelectionRect.clear();
      this.#graphItemSelectionRect.beginPath();
      this.#graphItemSelectionRect.rect(x, y, w, h);
      this.#graphItemSelectionRect.closePath();
      this.#graphItemSelectionRect.stroke({
        width: 1,
        color: selectionBoxBorderColor,
      });
      this.#graphItemSelectionRect.fill({
        color: selectionBoxBackgroundColor,
        alpha: selectionBoxBackgroundAlpha,
      });

      this.#selectWithin(new PIXI.Rectangle(x, y, w, h), evt.shiftKey);
      this.#emitSelection();
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
        }

        this.#removeEffect("container");
        this.#selectWithin(new PIXI.Rectangle(0, 0, 0, 0), evt.shiftKey);
        this.#emitSelection();
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
      this.#removeEffect("container");
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
        const scaleMatrix = new PIXI.Matrix();
        scaleMatrix
          .identity()
          .scale(this.#container.scale.x, this.#container.scale.y)
          .translate(this.#container.x, this.#container.y);

        // Update with the mousewheel position & delta.
        scaleMatrix
          .translate(-pivot.x, -pivot.y)
          .scale(delta, delta)
          .translate(pivot.x, pivot.y);

        // Ensure that it is always on a square pixel.
        scaleMatrix.tx = Math.round(scaleMatrix.tx);
        scaleMatrix.ty = Math.round(scaleMatrix.ty);

        // Apply back to the container.
        this.#container.setFromMatrix(scaleMatrix);

        if (!this.#background) {
          return;
        }

        this.#background.tileTransform.setFromMatrix(scaleMatrix);
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

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
    window.addEventListener("pointerdown", this.#onPointerDownBound);
    window.addEventListener("keyup", this.#onKeyUpBound);
    window.addEventListener("keydown", this.#onKeyDownBound);
    this.addEventListener("wheel", this.#onWheelBound, { passive: false });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#removeAllGraphs();

    if ("stop" in this.#app) {
      this.#app.stop();
    }

    this.#app.destroy();
    this.#appInitialized = false;

    this.#resizeObserver.disconnect();
    window.removeEventListener("pointerdown", this.#onPointerDownBound);
    window.removeEventListener("keyup", this.#onKeyUpBound);
    window.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("wheel", this.#onWheelBound);
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has("graphTopologyUpdateId")) {
      return true;
    }

    if (changedProperties.has("_portTooltip")) {
      return false;
    }

    if (changedProperties.has("topGraphUrl")) {
      return true;
    }

    if (changedProperties.has("selectionChangeId")) {
      return this.selectionChangeId !== this.#lastSelectionChangeId;
    }

    return true;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    this.#configChanged = changedProperties.has("configs");

    const topGraphUrlChanged = changedProperties.has("topGraphUrl");
    const subGraphSelectionChanged =
      !this.showSubgraphsInline && changedProperties.has("selectionChangeId");
    const visualModeChanged = changedProperties.has("showSubgraphsInline");

    if (topGraphUrlChanged || subGraphSelectionChanged || visualModeChanged) {
      this.#topGraphUrlChanged = true;
      this.#graphsRendered = false;
      this.#removeAllGraphs();
    }

    if (this.#graphsRendered && changedProperties.has("selectionChangeId")) {
      // Only observe selection changes when we're not dealing with the top
      // level graph.
      this.#selectionHasChanged = true;
    }

    if (!this.ready && changedProperties.has("assetPrefix")) {
      this.ready = this.#loadTexturesAndInitializeRenderer();
    }
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

    if (this.#selectionHasChanged && this.moveToSelection) {
      this.#selectionHasChanged = false;

      let shouldAnimate =
        this.moveToSelection && this.moveToSelection === "animated";
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        shouldAnimate = false;
      }

      // Wait a frame for the changes to be applied to the graph before trying
      // to move to the selection.
      requestAnimationFrame(() => {
        this.#setTargetContainerMatrix(shouldAnimate);
      });
    }
  }

  #toggleToolBoardMarkersOnGraphs() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.showBoardReferenceMarkers = this.#showBoardReferenceMarkers;
    }
  }

  #emitGraphMoveEvent(
    delta: PIXI.PointData,
    targetGraphId: GraphIdentifier | null
  ) {
    const selections: WorkspaceSelectionState = {
      graphs: new Map<GraphIdentifier, GraphSelectionState>(),
      modules: new Set(),
    };

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      const graphSelection = graph.selectionState;
      if (
        graphSelection &&
        (graphSelection.nodes.size > 0 ||
          graphSelection.comments.size > 0 ||
          graphSelection.edges.size > 0 ||
          graphSelection.references.size > 0)
      ) {
        selections.graphs.set(
          graph.subGraphId ?? MAIN_BOARD_ID,
          graphSelection
        );
      }
    }

    // Check the selection is valid.
    if (selections.graphs.size === 0) {
      return;
    }

    this.dispatchEvent(
      new WorkspaceSelectionMoveEvent(selections, targetGraphId, delta)
    );
  }

  #emitGraphVisualInformation() {
    const visualStates: WorkspaceVisualState = new Map<
      GraphIdentifier,
      GraphVisualState
    >();

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      const visualState = graph.visualState;
      visualStates.set(graph.subGraphId ?? MAIN_BOARD_ID, visualState);
    }

    const changeId = this.#visualChangeId();
    this.dispatchEvent(new WorkspaceVisualUpdateEvent(changeId, visualStates));
  }

  #emitSelection(
    replaceExistingSelections = true,
    moveToSelection: MoveToSelection = false
  ) {
    const selections: WorkspaceSelectionState = {
      graphs: new Map<GraphIdentifier, GraphSelectionState>(),
      modules: new Set(),
    };
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      const graphSelection = graph.selectionState;
      if (
        graphSelection &&
        (graphSelection.nodes.size > 0 ||
          graphSelection.comments.size > 0 ||
          graphSelection.edges.size > 0 ||
          graphSelection.references.size > 0)
      ) {
        selections.graphs.set(
          graph.subGraphId ?? MAIN_BOARD_ID,
          graphSelection
        );
      }
    }

    const changeId = this.#selectionChangeId();
    this.#lastSelectionChangeId = changeId;
    if (selections.graphs.size === 0) {
      this.dispatchEvent(new WorkspaceSelectionStateEvent(changeId, null));
      return;
    }

    this.dispatchEvent(
      new WorkspaceSelectionStateEvent(
        changeId,
        selections,
        replaceExistingSelections,
        moveToSelection
      )
    );
  }

  #selectWithin(rect: PIXI.Rectangle, retainExistingSelection = false) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.visible) {
        continue;
      }

      const graphSelection = graph.createGraphSelectionFrom(
        rect,
        retainExistingSelection
      );
      graph.selectionState = { ...graphSelection };
    }
  }

  #visualChangeId(): WorkspaceVisualChangeId {
    return crypto.randomUUID();
  }

  #selectionChangeId(): WorkspaceSelectionChangeId {
    return crypto.randomUUID();
  }

  #notifyEdgeSelection(edge: EdgeData) {
    if (!this.#activeGraph) {
      return;
    }

    const graphSelection =
      this.#activeGraph.selectionState ?? emptySelectionState();
    graphSelection.edges.add(inspectableEdgeToString(edge));

    this.#activeGraph.selectionState = { ...graphSelection };
    this.#activeGraph = null;
    this.#emitSelection();
  }

  #toggleGraphNodeSelection(
    graph: Graph,
    id: NodeIdentifier,
    isCtrlCommand: boolean
  ) {
    let selectionState = graph.selectionState;
    if (!selectionState) {
      selectionState = emptySelectionState();
    }

    if (isCtrlCommand) {
      if (selectionState.nodes.has(id)) {
        selectionState.nodes.delete(id);
      } else {
        selectionState.nodes.add(id);
      }
    } else {
      if (!selectionState.nodes.has(id)) {
        selectionState.edges.clear();
        selectionState.nodes.clear();
        selectionState.references.clear();
        selectionState.comments.clear();
        selectionState.nodes.add(id);
      }
    }

    graph.selectionState = { ...selectionState };
  }

  #toggleGraphSelection(graph: Graph, isCtrlCommand: boolean) {
    const selectionState = graph.selectionState ?? emptySelectionState();
    const newSelectionState = emptySelectionState();
    for (const node of graph.children) {
      if (node instanceof GraphNode) {
        newSelectionState.nodes.add(node.label);

        const referencePorts =
          node.inPorts?.filter(
            (port) =>
              isBoardBehavior(port.schema) || isBoardArrayBehavior(port.schema)
          ) ?? [];

        for (const port of referencePorts) {
          if (Array.isArray(port.value)) {
            for (let i = 0; i < port.value.length; i++) {
              newSelectionState.references.add(
                `${node.label}|${port.name}|${i}`
              );
            }
          } else {
            newSelectionState.references.add(`${node.label}|${port.name}|0`);
          }
        }
      }

      if (node instanceof GraphComment) {
        newSelectionState.comments.add(node.label);
      }
    }

    if (graph.edges) {
      for (const edge of graph.edges) {
        newSelectionState.edges.add(inspectableEdgeToString(edge));
      }
    }

    if (
      selectionState.nodes.size === newSelectionState.nodes.size &&
      selectionState.comments.size === newSelectionState.comments.size &&
      selectionState.edges.size === newSelectionState.edges.size &&
      selectionState.references.size === newSelectionState.references.size
    ) {
      if (isCtrlCommand) {
        selectionState.edges.clear();
        selectionState.nodes.clear();
        selectionState.references.clear();
        selectionState.comments.clear();
      }
      graph.selectionState = { ...selectionState };
    } else {
      graph.selectionState = newSelectionState;
    }
  }

  #toggleGraphEdgeSelection(graph: Graph, id: string, isCtrlCommand: boolean) {
    let selectionState = graph.selectionState;
    if (!selectionState) {
      selectionState = emptySelectionState();
    }

    if (isCtrlCommand) {
      if (selectionState.edges.has(id)) {
        selectionState.edges.delete(id);
      } else {
        selectionState.edges.add(id);
      }
    } else {
      if (!selectionState.edges.has(id)) {
        selectionState.edges.clear();
        selectionState.nodes.clear();
        selectionState.references.clear();
        selectionState.comments.clear();

        selectionState.edges.add(id);
      }
    }

    graph.selectionState = { ...selectionState };
  }

  #toggleGraphCommentSelection(
    graph: Graph,
    id: string,
    isCtrlCommand: boolean
  ) {
    let selectionState = graph.selectionState;
    if (!selectionState) {
      selectionState = emptySelectionState();
    }

    if (isCtrlCommand) {
      if (selectionState.comments.has(id)) {
        selectionState.comments.delete(id);
      } else {
        selectionState.comments.add(id);
      }
    } else {
      if (!selectionState.comments.has(id)) {
        selectionState.edges.clear();
        selectionState.nodes.clear();
        selectionState.references.clear();
        selectionState.comments.clear();

        selectionState.comments.add(id);
      }
    }

    graph.selectionState = { ...selectionState };
  }

  #toggleGraphNodeReferenceSelection(
    graph: Graph,
    nodeId: NodeIdentifier,
    portId: PortIdentifier,
    index: number,
    isCtrlCommand: boolean
  ) {
    let selectionState = graph.selectionState;
    if (!selectionState) {
      selectionState = emptySelectionState();
    }

    const id: ReferenceIdentifier = `${nodeId}|${portId}|${index}`;

    if (isCtrlCommand) {
      if (selectionState.references.has(id)) {
        selectionState.references.delete(id);
      } else {
        selectionState.references.add(id);
      }
    } else {
      if (!selectionState.references.has(id)) {
        selectionState.edges.clear();
        selectionState.nodes.clear();
        selectionState.references.clear();
        selectionState.comments.clear();

        selectionState.references.add(id);
      }
    }

    graph.selectionState = { ...selectionState };
  }

  #clearOtherGraphSelections(except: Graph) {
    for (const child of this.#container.children) {
      if (!(child instanceof Graph) || child === except) {
        continue;
      }

      child.selectionState = emptySelectionState();
    }
  }

  #applyPositionDeltaToSelection(delta: PIXI.Point, settled = false) {
    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      child.updateNodePositions(delta, settled);
    }
  }

  #removeGraph(graph: Graph) {
    graph.removeFromParent();
    graph.destroy({ children: true });
  }

  #removeAllGraphs() {
    // Copy the children array so that it doesn't mutate underneath us as
    // we remove the children.
    for (const graph of [...this.#container.children]) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      this.#removeGraph(graph);
    }
  }

  intersectingBoardPort(point: PIXI.PointData):
    | {
        graphId: GraphIdentifier;
        nodeId: NodeIdentifier;
        portId: PortIdentifier;
      }
    | false {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      if (graph.getBounds().containsPoint(point.x, point.y)) {
        const port = graph.intersectingBoardPort(point);
        if (port) {
          return { graphId: graph.subGraphId ?? MAIN_BOARD_ID, ...port };
        }
        return false;
      }
    }

    return false;
  }

  toContainerCoordinates(point: PIXI.PointData) {
    return this.#container.toLocal(point);
  }

  highlightSubGraphId(point: PIXI.PointData) {
    let target: Graph | null = null;
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.highlightDragOver = false;
      if (graph.getBounds().containsPoint(point.x, point.y)) {
        target = graph;
        break;
      }
    }

    if (target) {
      target.highlightDragOver = true;
    }
  }

  removeSubGraphHighlights() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.highlightDragOver = false;
    }
  }

  highlightBoardPort(point: PIXI.PointData) {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      if (graph.getBounds().containsPoint(point.x, point.y)) {
        const port = graph.intersectingBoardPort(point);
        if (!port) {
          continue;
        }

        graph.highlightForBoardPort(port.nodeId);
      }
    }
  }

  removeBoardPortHighlights() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.removeHighlightForBoardPort();
    }
  }

  toSubGraphId(point: PIXI.PointData): GraphIdentifier | null {
    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      if (child.getBounds().containsPoint(point.x, point.y)) {
        return child.subGraphId;
      }
    }

    return null;
  }

  #calculateTargetContainerMatrixFromBounds(bounds: PIXI.Bounds): PIXI.Matrix {
    const targetContainerMatrix = new PIXI.Matrix();
    targetContainerMatrix.identity();

    if (!bounds.isValid) {
      return targetContainerMatrix;
    }

    const rendererBounds = this.getBoundingClientRect();
    targetContainerMatrix.translate(
      -bounds.x + (rendererBounds.width - bounds.width) * 0.5,
      -bounds.y + (rendererBounds.height - bounds.height) * 0.5
    );

    // Scale.
    let delta = Math.min(
      (rendererBounds.width - 2 * this.padding) / bounds.width,
      (rendererBounds.height - 2 * this.padding) / bounds.height,
      1
    );

    if (delta < this.minScale) {
      delta = this.minScale;
    }

    const pivot = {
      x: rendererBounds.width / 2,
      y: rendererBounds.height / 2,
    };

    targetContainerMatrix
      .translate(-pivot.x, -pivot.y)
      .scale(delta, delta)
      .translate(pivot.x, pivot.y);

    // Ensure that it is always on a square pixel.
    targetContainerMatrix.tx = Math.round(targetContainerMatrix.tx);
    targetContainerMatrix.ty = Math.round(targetContainerMatrix.ty);

    // Also ensure that the matrix values remain positive.
    targetContainerMatrix.a = Math.max(targetContainerMatrix.a, 0);
    targetContainerMatrix.b = Math.max(targetContainerMatrix.b, 0);
    targetContainerMatrix.c = Math.max(targetContainerMatrix.c, 0);
    targetContainerMatrix.d = Math.max(targetContainerMatrix.d, 0);

    return targetContainerMatrix;
  }

  #createBoundsFromAllGraphs() {
    const bounds = new PIXI.Bounds();
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      if (graph.minimized) {
        continue;
      }

      for (const node of graph.children) {
        if (!(node instanceof GraphNode || node instanceof GraphComment)) {
          continue;
        }

        const graphNode = graph.getGraphNodeById(node.label);
        const graphNodePosition = graph.getNodeLayoutPosition(node.label);
        if (!graphNode || !graphNodePosition) {
          continue;
        }

        const x = graphNodePosition.x;
        const y = graphNodePosition.y;
        const bound = new PIXI.Bounds(
          x,
          y,
          x + graphNode.width,
          y + graphNode.height
        );

        bounds.addBounds(bound);
      }
    }

    return bounds;
  }

  #createBoundsFromSelection() {
    const bounds = new PIXI.Bounds();
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph) || !graph.selectionState) {
        continue;
      }

      if (graph.minimized) {
        const positions = graph.getNodeLayoutPositions();
        let x = Number.POSITIVE_INFINITY;
        let y = Number.POSITIVE_INFINITY;
        for (const position of positions.values()) {
          x = Math.min(x, position.x);
          y = Math.min(y, position.y);
        }

        if (x === Number.POSITIVE_INFINITY) {
          x = 0;
        }

        if (y === Number.POSITIVE_INFINITY) {
          y = 0;
        }

        const bound = new PIXI.Bounds(x, y, x + 20, y + 1);
        bounds.addBounds(bound);
        continue;
      }

      for (const node of graph.selectionState.nodes) {
        const graphNode = graph.getGraphNodeById(node);
        const graphNodePosition = graph.getNodeLayoutPosition(node);
        if (!graphNode || !graphNodePosition) {
          continue;
        }

        const x = graphNodePosition.x;
        const y = graphNodePosition.y;
        const bound = new PIXI.Bounds(
          x,
          y,
          x + graphNode.width,
          y + graphNode.height
        );

        bounds.addBounds(bound);
      }
    }

    return bounds;
  }

  zoomToFit(animate = false) {
    const matrix = this.#calculateTargetContainerMatrixFromBounds(
      this.#createBoundsFromAllGraphs()
    );

    this.#updateContainerFromTargetMatrix(matrix, animate);
  }

  #setTargetContainerMatrix(animate = false) {
    let matrix = this.#calculateTargetContainerMatrixFromBounds(
      this.#createBoundsFromSelection()
    );
    if (matrix.isIdentity()) {
      matrix = this.#calculateTargetContainerMatrixFromBounds(
        this.#createBoundsFromAllGraphs()
      );
    }

    this.#updateContainerFromTargetMatrix(matrix, animate);
  }

  #effects = new Map<string, () => void>();
  #addEffect(name: string, effect: () => void) {
    this.#effects.set(name, effect);
  }

  #removeEffect(name: string) {
    this.#effects.delete(name);
  }

  #updateContainerFromTargetMatrix(matrix: PIXI.Matrix, animate = false) {
    if (!animate) {
      this.#container.setFromMatrix(matrix);
      this.#background?.tileTransform.setFromMatrix(matrix);
      return;
    }

    if (matrix.isIdentity()) {
      console.warn("Unable to set container matrix");
      return;
    }

    function effect(this: GraphRenderer, matrix: PIXI.Matrix) {
      const EASING = 10;
      const THRESHOLD = 0.001;
      const current = this.#container.worldTransform.clone();

      current.a += (matrix.a - current.a) / EASING;
      current.b += (matrix.b - current.b) / EASING;
      current.c += (matrix.c - current.c) / EASING;
      current.d += (matrix.d - current.d) / EASING;
      current.tx += (matrix.tx - current.tx) / EASING;
      current.ty += (matrix.ty - current.ty) / EASING;

      if (
        Math.abs(current.a - matrix.a) < THRESHOLD &&
        Math.abs(current.b - matrix.b) < THRESHOLD &&
        Math.abs(current.c - matrix.c) < THRESHOLD &&
        Math.abs(current.d - matrix.d) < THRESHOLD &&
        Math.abs(current.tx - matrix.tx) < THRESHOLD &&
        Math.abs(current.ty - matrix.ty) < THRESHOLD
      ) {
        this.#container.setFromMatrix(matrix);
        this.#background?.tileTransform.setFromMatrix(matrix);
        this.#removeEffect("container");
        return;
      }

      this.#container.setFromMatrix(current);
      this.#background?.tileTransform.setFromMatrix(current);
    }

    this.#addEffect("container", effect.bind(this, matrix));
  }

  #onPointerDown() {
    this.dispatchEvent(new GraphInteractionEvent());
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.code === "Space") {
      this.#mode = MODE.MOVE;
      return;
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

  async #loadTexturesAndInitializeRenderer() {
    if (this.#appInitialized) {
      return this.#app.canvas;
    }

    if (GraphAssets.assetPrefix !== this.assetPrefix) {
      GraphAssets.instance().loadAssets(this.assetPrefix);
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
    this.#app.ticker.add(() => {
      for (const effect of this.#effects.values()) {
        effect.call(this);
      }
    });
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
                this.#notifyEdgeSelection(edge);
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

    if (!this.ready) {
      return nothing;
    }

    return [
      until(
        this.ready.then((canvas) => {
          if (this.#configChanged) {
            this.#configChanged = false;
            this.#applyConfigs();
          }

          this.#handleTopGraphResult();
          return html`${canvas}`;
        })
      ),
      overflowMenu,
      edgeSelectDisambiguationMenu,
      edgeMenu,
      this.#renderPortTooltip(),
    ];
  }

  #handleTopGraphResult() {
    let highlightedNode = null;
    let edgeValues = null;
    let nodeInfo = null;

    if (this.topGraphResult && this.topGraphResult.currentNode) {
      highlightedNode = this.topGraphResult.currentNode;
    }

    if (this.topGraphResult && this.topGraphResult.edgeValues) {
      edgeValues = this.topGraphResult.edgeValues;
    }

    if (this.topGraphResult && this.topGraphResult.nodeInformation) {
      nodeInfo = this.topGraphResult.nodeInformation;
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

  #showAllGraphs() {
    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      child.alpha = 1;
    }
  }

  #applyConfigs() {
    if (!this.configs || this.configs.size === 0) {
      this.#removeAllGraphs();
      this.#hideBackground();
      return;
    }

    this.#showBackground();

    let graphCount = 0;
    const subGraphsSeen = new Set<string>();
    for (const [id, config] of this.configs) {
      const subGraphId = id === MAIN_BOARD_ID ? null : id;
      if (id !== MAIN_BOARD_ID) {
        subGraphsSeen.add(id);
      }

      const graphUrl = this.#createUrl(config.url, subGraphId);
      if (this.#updateGraphByUrl(config.url, subGraphId, config)) {
        continue;
      }

      graphCount++;

      const graph = new Graph();
      graph.label = graphUrl;
      graph.alpha = GRAPH_HIDDEN_ALPHA;

      // Initial Draw - wait for all graphs before attempting to move.
      if (this.#topGraphUrlChanged) {
        graph.once(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW, () => {
          graphCount--;
          if (graphCount === 0) {
            // Wait a frame so that all changes have been applied.
            requestAnimationFrame(() => {
              this.#showAllGraphs();
              this.#graphsRendered = true;
              this.#setTargetContainerMatrix(false);
            });
          }
        });
      }

      this.#addGraph(graph);
      this.#updateGraphByUrl(config.url, subGraphId, config);
    }

    if (this.#graphsRendered) {
      this.#showAllGraphs();
    }

    this.#topGraphUrlChanged = false;
    this.#removeStaleSubGraphs(subGraphsSeen);
  }

  #createMoveCloneGraph() {
    this.#removeMoveCloneGraph();

    const references: GraphReferences = new Map<
      NodeIdentifier,
      GraphNodeReferences
    >();
    const comments: CommentNode[] = [];
    const edges: InspectableEdge[] = [];
    const nodes: InspectableNode[] = [];
    const ports: Map<NodeIdentifier, InspectableNodePorts> = new Map();
    const typeMetadata: Map<string, NodeHandlerMetadata> = new Map();
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      const state = graph.selectionState;
      if (!state) {
        continue;
      }

      if (graph.ports) {
        for (const node of state.nodes) {
          const port = graph.ports.get(node);
          if (port) {
            ports.set(node, port);
          }
        }
      }

      if (graph.edges) {
        edges.push(
          ...graph.edges.filter((e) =>
            state.edges.has(inspectableEdgeToString(e))
          )
        );
      }

      if (graph.nodes) {
        nodes.push(
          ...graph.nodes.filter((n) => state.nodes.has(n.descriptor.id))
        );
      }

      if (graph.comments) {
        comments.push(
          ...graph.comments.filter((c) => state.comments.has(c.id))
        );
      }

      if (graph.typeMetadata) {
        graph.typeMetadata.forEach((v, k) => {
          typeMetadata.set(k, v);
        });
      }

      if (graph.references) {
        graph.references.forEach((v, k) => {
          references.set(k, v);
        });
      }
    }

    this.#moveCloneGraph = new Graph();
    this.#moveCloneGraph.subGraphId = "move-clone-graph";
    this.#moveCloneGraph.eventMode = "none";
    this.#moveCloneGraph.comments = comments;
    this.#moveCloneGraph.nodes = nodes;
    this.#moveCloneGraph.ports = ports;
    this.#moveCloneGraph.references = references;
    this.#moveCloneGraph.showNodePreviewValues = true;
    this.#moveCloneGraph.typeMetadata = typeMetadata;
    this.#moveCloneGraph.edges = edges;
    this.#moveCloneGraph.alpha = 0;

    this.#moveCloneGraph.on(GRAPH_OPERATIONS.GRAPH_DRAW, () => {
      if (!this.#moveCloneGraph) {
        return;
      }

      this.#moveCloneGraph.layout();
    });

    this.#moveCloneGraph.on(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW, () => {
      if (!this.#moveCloneGraph) {
        return;
      }

      this.#moveCloneGraph.cacheAsTexture(true);
      this.#moveCloneGraph.alpha = 0.65;
    });

    this.#moveCloneGraph.graphOutlineVisible = false;

    this.#container.addChild(this.#moveCloneGraph);
  }

  #removeMoveCloneGraph() {
    if (!this.#moveCloneGraph) {
      return;
    }

    this.#moveCloneGraph.removeFromParent();
    this.#moveCloneGraph.destroy({
      children: true,
    });
    this.#moveCloneGraph = null;
  }

  #addGraph(graph: Graph) {
    graph.on(
      GRAPH_OPERATIONS.SUBGRAPH_SELECTED,
      (isCtrlCommand: boolean, graphId?: GraphIdentifier) => {
        let moveToSelection: MoveToSelection = false;
        let targetGraph: Graph | undefined = graph;
        if (graphId) {
          targetGraph = this.#container.children.find(
            (graph) => graph instanceof Graph && graph.subGraphId === graphId
          ) as Graph;
          if (!targetGraph) {
            return;
          }

          moveToSelection = "animated";
        }

        if (!isCtrlCommand) {
          this.#clearOtherGraphSelections(targetGraph);
        }
        this.#toggleGraphSelection(targetGraph, isCtrlCommand);
        this.#emitSelection(true, moveToSelection);

        if (!moveToSelection) {
          return;
        }
        this.#setTargetContainerMatrix(true);
      }
    );

    graph.on(GRAPH_OPERATIONS.MODULE_SELECTED, (moduleId: ModuleIdentifier) => {
      const selectionChangeId = this.#selectionChangeId();
      const selectionState = emptyWorkspaceSelectionState();
      selectionState.modules.add(moduleId);

      this.dispatchEvent(
        new WorkspaceSelectionStateEvent(
          selectionChangeId,
          selectionState,
          true,
          "immediate"
        )
      );
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_REFERENCE_LOAD, (reference) => {
      this.dispatchEvent(new StartEvent(reference));
    });

    graph.on(GRAPH_OPERATIONS.WARN_USER, (message: string) => {
      this.dispatchEvent(new ToastEvent(message, ToastType.WARNING));
    });

    graph.on(
      GRAPH_OPERATIONS.SUBGRAPH_CONNECTION_START,
      (x: number, y: number) => {
        if (!graph.subGraphId) {
          return;
        }

        this.dispatchEvent(
          new DragConnectorStartEvent({ x, y }, `#${graph.subGraphId}`)
        );
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_TOGGLE_MINIMIZED, () => {
      this.#emitGraphVisualInformation();
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE, () => {
      this.#emitGraphVisualInformation();
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_SELECTION_MOVE,
      (
        delta,
        sourcePosition?: PIXI.PointData,
        isMoveOp = false,
        isCloneOp = false
      ) => {
        if (sourcePosition) {
          const targetPoint = new PIXI.Point(
            sourcePosition.x,
            sourcePosition.y
          );

          targetPoint.x += delta.x * this.#container.worldTransform.a;
          targetPoint.y += delta.y * this.#container.worldTransform.a;

          if (isMoveOp) {
            if (!this.#moveCloneGraph) {
              this.#createMoveCloneGraph();
            }

            if (!this.#moveCloneGraph) {
              return;
            }

            this.#moveCloneGraph.x = delta.x;
            this.#moveCloneGraph.y = delta.y;
            return;
          }

          if (isCloneOp) {
            // TODO: Represent
            return;
          }
        }

        this.#applyPositionDeltaToSelection(delta);
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_SELECTION_MOVE_SETTLED,
      (
        delta,
        sourcePosition?: PIXI.PointData,
        isMoveOp = false,
        isCloneOp = false
      ) => {
        if (sourcePosition) {
          const targetPoint = new PIXI.Point(
            sourcePosition.x,
            sourcePosition.y
          );

          targetPoint.x += delta.x * this.#container.worldTransform.a;
          targetPoint.y += delta.y * this.#container.worldTransform.a;

          if (this.#moveCloneGraph) {
            this.#removeMoveCloneGraph();
          }

          if (isMoveOp) {
            let targetGraphId: GraphIdentifier | null = null;
            if (sourcePosition) {
              for (const graph of this.#container.children) {
                if (!(graph instanceof Graph)) {
                  continue;
                }

                if (
                  graph.getBounds().containsPoint(targetPoint.x, targetPoint.y)
                ) {
                  targetGraphId = graph.subGraphId ?? MAIN_BOARD_ID;
                  break;
                }
              }
            }

            this.#emitGraphMoveEvent(delta, targetGraphId);
            return;
          }

          if (isCloneOp) {
            console.log("clone finished", delta);
            return;
          }
        }

        this.#applyPositionDeltaToSelection(delta, true);
        this.#emitGraphVisualInformation();
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_TOGGLE_SELECTED,
      (id: NodeIdentifier, isCtrlCommand: boolean) => {
        if (!isCtrlCommand && !graph.selectionState?.nodes.has(id)) {
          this.#clearOtherGraphSelections(graph);
        }
        this.#toggleGraphNodeSelection(graph, id, isCtrlCommand);
        this.#emitSelection();
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_COMMENT_TOGGLE_SELECTED,
      (id: NodeIdentifier, isCtrlCommand: boolean) => {
        this.#toggleGraphCommentSelection(graph, id, isCtrlCommand);
        this.#emitSelection();
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_TOGGLE_SELECTED,
      (id: NodeIdentifier, isCtrlCommand: boolean) => {
        this.#toggleGraphEdgeSelection(graph, id, isCtrlCommand);
        this.#emitSelection();
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_REFERENCE_TOGGLE_SELECTED,
      (
        nodeId: NodeIdentifier,
        portId: PortIdentifier,
        index: number,
        isCtrlCommand: boolean
      ) => {
        this.#toggleGraphNodeReferenceSelection(
          graph,
          nodeId,
          portId,
          index,
          isCtrlCommand
        );
        this.#emitSelection();
      }
    );

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

  #updateGraphByUrl(
    url: string,
    subGraphId: string | null,
    opts: Partial<GraphOpts>
  ): boolean {
    const graph = this.#container.children.find(
      (child) => child.label === this.#createUrl(url, subGraphId)
    );

    if (!(graph instanceof Graph)) {
      return false;
    }

    graph.readOnly = this.readOnly;
    graph.highlightInvalidWires = this.highlightInvalidWires;

    if (opts.showNodePreviewValues !== undefined) {
      graph.showNodePreviewValues = opts.showNodePreviewValues;
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

    if (opts.minimized !== undefined) {
      graph.minimized = opts.minimized;
    }

    if (opts.selectionState !== undefined) {
      graph.selectionState = opts.selectionState;
    }

    if (opts.references !== undefined) {
      graph.references = opts.references;
    }

    graph.subGraphId = subGraphId;
    graph.graphTitle = opts.title ?? null;
    graph.graphOutlineVisible = opts.showGraphOutline ?? false;

    return true;
  }

  #createUrl(url: string, subGraphId: string | null) {
    return url + (subGraphId ? `#${subGraphId}` : "");
  }

  #removeStaleSubGraphs(keep: Set<GraphIdentifier>) {
    for (let c = this.#container.children.length; c >= 0; c--) {
      const child = this.#container.children[c];
      if (!(child instanceof Graph)) {
        continue;
      }
      if (!child.subGraphId) {
        continue;
      }
      if (keep.has(child.subGraphId)) {
        continue;
      }
      child.removeFromParent();
      child.destroy({ children: true });
    }
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
