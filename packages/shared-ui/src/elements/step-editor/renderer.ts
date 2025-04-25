/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  html,
  css,
  nothing,
  PropertyValues,
  HTMLTemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Graph } from "./graph";
import { Camera } from "./camera";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { calculateBounds } from "./utils/calculate-bounds";
import { clamp } from "./utils/clamp";
import {
  Edge,
  EditSpec,
  GraphIdentifier,
  InspectableGraph,
  InspectableNode,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeDescriptor,
  NodeIdentifier,
  NodeValue,
} from "@google-labs/breadboard";
import { MAIN_BOARD_ID } from "../../constants/constants";
import {
  CreateNewAssetsEvent,
  GraphEdgeAttachmentMoveEvent,
  NodeAddEvent,
  NodeConfigurationRequestEvent,
  NodeSelectEvent,
  SelectGraphContentsEvent,
  SelectionMoveEvent,
  SelectionTranslateEvent,
} from "./events/events";
import {
  NewAsset,
  HighlightStateWithChangeId,
  TopGraphRunResult,
  WorkspaceSelectionStateWithChangeId,
} from "../../types/types";
import {
  createEmptyGraphHighlightState,
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  createWorkspaceSelectionChangeId,
} from "../../utils/workspace";
import {
  DragConnectorStartEvent,
  EditorPointerPositionChangeEvent,
  AddNodeWithEdgeEvent,
  MultiEditEvent,
  NodeConfigurationUpdateRequestEvent,
  WorkspaceSelectionStateEvent,
  ZoomToFitEvent,
  MoveNodesEvent,
  EdgeAttachmentMoveEvent,
  DroppedAssetsEvent,
  ZoomInEvent,
  ZoomOutEvent,
} from "../../events/events";
import { styleMap } from "lit/directives/style-map.js";
import { Entity } from "./entity";
import { toGridSize } from "./utils/to-grid-size";
import { DragConnector } from "./drag-connector";
import { collectAssetIds, collectNodeIds } from "./utils/collect-ids";
import { EditorControls } from "./editor-controls";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { DATA_TYPE, MOVE_GRAPH_ID } from "./constants";
import { AssetMetadata } from "@breadboard-ai/types";
import { isCtrlCommand } from "../../utils/is-ctrl-command";
import { RendererState } from "../../state";

@customElement("bb-renderer")
export class Renderer extends LitElement {
  @property()
  accessor debug = false;

  @property({ reflect: true, type: Boolean })
  accessor readOnly = false;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor boardServerKits: Kit[] | null = null;

  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property()
  accessor state: RendererState | null = null;

  @property()
  accessor graphStoreUpdateId = 0;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor showExperimentalComponents = false;

  @property()
  accessor showAssetsInGraph = false;

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  accessor highlightState: HighlightStateWithChangeId | null = null;

  @property({ reflect: true })
  accessor interactionMode: "inert" | "selection" | "pan" | "move" = "inert";

  @property({ reflect: true, type: Boolean })
  accessor isDragPanning = false;

  @property()
  accessor camera = new Camera();

  @property()
  accessor dragConnector = new DragConnector();

  @property()
  accessor tick = 0;

  @property()
  accessor zoomFactor = 250;

  @property()
  accessor minScale = 0.5;

  @property()
  accessor maxScale = 3;

  @property()
  accessor cullPadding = 0;

  @property()
  accessor graphFitPadding = 100;

  @property()
  accessor graphTopologyUpdateId = 0;

  @property()
  accessor expandSelections = true;

  @property()
  accessor allowEdgeAttachmentMove = true;

  @state()
  accessor _boundsDirty = new Set<string>();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-neutral-50);
      overflow: hidden;
      transform: translate(0, 0);
      contain: strict;
      container-type: size;
      user-select: none;
      width: 100%;
      height: 100%;
      outline: none;
      touch-action: none;
    }

    :host([readonly])::after {
      content: "";
      position: absolute;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0);
      top: 0;
      left: 0;
      z-index: 100;
    }

    :host([readonly])::before {
      content: "Read Only";
      display: flex;
      align-items: center;
      box-sizing: border-box;
      position: absolute;
      top: 10px;
      left: 50%;
      translate: -50% 0;
      border-radius: var(--bb-grid-size-16);
      height: var(--bb-grid-size-7);
      border: 1px solid var(--bb-ui-200);
      background: var(--bb-ui-100);
      color: var(--bb-ui-800);
      padding: 0 var(--bb-grid-size-3);
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
    }

    :host([interactionmode="pan"]) {
      cursor: grab;
    }

    :host([interactionmode="pan"][isdragpanning]) {
      cursor: grabbing;
    }

    #overlay {
      display: none;
      position: absolute;
      border: 1px solid green;
      width: calc(100% + calc(2 * var(--cull-padding)));
      height: calc(100% + calc(2 * var(--cull-padding)));
      top: calc(var(--cull-padding) * -1);
      left: calc(var(--cull-padding) * -1);
      pointer-events: none;

      &.active {
        display: block;
      }
    }

    #selection {
      display: block;
      pointer-events: none;
      position: absolute;
      border: 1px solid var(--bb-neutral-500);
      background: oklch(from var(--bb-neutral-900) l c h / 0.05);
      z-index: 4;
    }

    bb-editor-controls {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 3;
    }
  `;

  #editorControls: Ref<EditorControls> = createRef();

  #lastBoundsForInteraction = new DOMRect();
  #boundsForInteraction = new DOMRect();
  #fitToViewPre = false;
  #fitToViewPost = false;
  #attemptAdjustToNewBounds = false;
  #firstResize = true;

  #onWheelBound = this.#onWheel.bind(this);
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onKeyUpBound = this.#onKeyUp.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onDropBound = this.#onDrop.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

  #resizeObserver = new ResizeObserver((entries) => {
    this.#lastBoundsForInteraction = this.#boundsForInteraction;
    this.#boundsForInteraction = this.getBoundingClientRect();

    if (this.#firstResize) {
      this.#fitToViewPre = true;
    } else {
      this.#attemptAdjustToNewBounds = true;
    }
    this.#firstResize = false;

    if (this.camera) {
      this.camera.bounds = entries[0].contentRect;
      this.tick++;
    }
  });
  #graphs = new Map<string, Graph>();
  #effects = new Map<string, () => void>();

  constructor() {
    super();

    this.tabIndex = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
    this.addEventListener("wheel", this.#onWheelBound);
    this.addEventListener("pointerdown", this.#onPointerDownBound);
    this.addEventListener("pointermove", this.#onPointerMoveBound);
    this.addEventListener("pointerup", this.#onPointerUpBound);
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);

    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("keyup", this.#onKeyUpBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();
    this.removeEventListener("wheel", this.#onWheelBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("pointerup", this.#onPointerUpBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);

    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("keyup", this.#onKeyUpBound);
  }

  #addEffect(name: string, effect: () => void) {
    this.#effects.set(name, effect);
    this.#runEffects();
  }

  #removeEffect(name: string) {
    this.#effects.delete(name);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.code !== "Space" || this.interactionMode === "pan") {
      return;
    }

    this.interactionMode = "pan";
  }

  #onKeyUp() {
    this.interactionMode = "inert";
  }

  #handleNewAssets(evt: CreateNewAssetsEvent) {
    evt.stopImmediatePropagation();

    // Augment the added assets with the x & y coordinates of the
    // middle of the graph and dispatch the dropped assets event.

    const targetGraph = this.#graphs.get(MAIN_BOARD_ID);
    if (!targetGraph) {
      console.warn("Unable to add to graph");
      return;
    }

    const x =
      this.#boundsForInteraction.width * 0.5 - this.#boundsForInteraction.left;
    const y =
      this.#boundsForInteraction.height * 0.5 - this.#boundsForInteraction.top;
    let graphLocation = new DOMPoint(x, y).matrixTransform(
      targetGraph.worldTransform.inverse()
    );

    graphLocation.x += targetGraph.transform.e;
    graphLocation.y += targetGraph.transform.f;

    if (Number.isNaN(graphLocation.x) || Number.isNaN(graphLocation.y)) {
      // Set as 130, 20 so that it gets reset to 0, 0 below.
      graphLocation = new DOMPoint(130, 20);
    }

    const visual = {
      x: toGridSize(graphLocation.x - 130),
      y: toGridSize(graphLocation.y - 20),
    };

    const assets = evt.assets;
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      asset.visual = { ...visual };

      asset.visual.x += i * 10;
      asset.visual.y += i * 10;
    }

    this.dispatchEvent(new DroppedAssetsEvent(assets));
  }

  async #handleDroppedAssets(evt: DragEvent) {
    if (
      !evt.dataTransfer ||
      !evt.dataTransfer.files ||
      !evt.dataTransfer.files.length
    ) {
      return;
    }

    const filesDropped = evt.dataTransfer.files;
    if ([...filesDropped].some((file) => file.type.includes("json"))) {
      return;
    }

    evt.stopImmediatePropagation();

    const targetGraph = this.#graphs.get(MAIN_BOARD_ID);
    if (!targetGraph) {
      console.warn("Unable to add to graph");
      return;
    }

    const x = evt.clientX - this.#boundsForInteraction.x;
    const y = evt.clientY - this.#boundsForInteraction.y;
    let graphLocation = new DOMPoint(x, y).matrixTransform(
      targetGraph.worldTransform.inverse()
    );

    graphLocation.x += targetGraph.transform.e;
    graphLocation.y += targetGraph.transform.f;

    if (Number.isNaN(graphLocation.x) || Number.isNaN(graphLocation.y)) {
      // Set as 130, 20 so that it gets reset to 0, 0 below.
      graphLocation = new DOMPoint(130, 20);
    }

    const visual = {
      x: toGridSize(graphLocation.x - 130),
      y: toGridSize(graphLocation.y - 20),
    };

    const assetLoad = [...filesDropped].map((file, idx) => {
      return new Promise<NewAsset>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("loadend", () => {
          if (reader.result === null) {
            reject("");
            return;
          }

          const preamble = `data:${file.type};base64,`;
          const data = (reader.result as string).substring(preamble.length);

          resolve({
            name: file.name,
            path: file.name,
            type: "file",
            visual: { x: visual.x + idx * 10, y: visual.y + idx * 10 },
            data: {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data,
                    mimeType: file.type,
                  },
                },
              ],
            },
          });
        });
        reader.readAsDataURL(file);
      });
    });

    const assets = await Promise.all(assetLoad);
    this.dispatchEvent(new DroppedAssetsEvent(assets));
  }

  #onDragOver(evt: DragEvent) {
    evt.preventDefault();
  }

  #onDrop(evt: DragEvent) {
    evt.preventDefault();

    const nodeType = evt.dataTransfer?.getData(DATA_TYPE);
    if (!nodeType) {
      this.#handleDroppedAssets(evt);
      return;
    }

    this.#createNode(
      nodeType,
      /** create at center */ true,
      evt.clientX - this.#boundsForInteraction.x,
      evt.clientY - this.#boundsForInteraction.y
    );
  }

  #getGraphTitleByType(nodeType: string) {
    let title = "Untitled item";
    for (const graph of this.graphStore?.graphs() ?? []) {
      if (graph.url === nodeType && graph.title) {
        title = graph.title;
        break;
      }
    }

    return title;
  }

  #createNode(
    nodeType: string,
    createAtCenter = true,
    x?: number,
    y?: number,
    connectedTo?: NodeIdentifier,
    subGraphId?: GraphIdentifier
  ) {
    let useXandYCoordinatesForSubgraph = true;
    if (!x || !y) {
      // Auto-drop to the middle, don't use the x & y coordinates.
      useXandYCoordinatesForSubgraph = false;

      x =
        this.#boundsForInteraction.width * 0.5 -
        this.#boundsForInteraction.left;
      y =
        this.#boundsForInteraction.height * 0.5 -
        this.#boundsForInteraction.top;
    }

    // Start with finding the natural intersection for the created node if the
    // x & y coordinates were set.
    const addLocation = new DOMRect(x, y, 0, 0);
    let targetGraphId = MAIN_BOARD_ID;
    if (useXandYCoordinatesForSubgraph) {
      for (const [graphId, graph] of this.#graphs) {
        if (graphId === MAIN_BOARD_ID) {
          continue;
        }

        if (graph.intersects(addLocation, 0)) {
          targetGraphId = graphId;
          break;
        }
      }
    }

    // If a subGraph has been provided, use that instead.
    if (subGraphId) {
      targetGraphId = subGraphId;
    }

    const targetGraph = this.#graphs.get(targetGraphId);
    if (!targetGraph) {
      console.warn("Unable to add to graph");
      return;
    }

    let graphLocation = new DOMPoint(x, y).matrixTransform(
      targetGraph.worldTransform.inverse()
    );

    graphLocation.x += targetGraph.transform.e;
    graphLocation.y += targetGraph.transform.f;

    if (Number.isNaN(graphLocation.x) || Number.isNaN(graphLocation.y)) {
      // Set as 130, 20 so that it gets reset to 0, 0 below.
      graphLocation = new DOMPoint(130, 20);
    }

    const id = globalThis.crypto.randomUUID();
    const title = this.#getGraphTitleByType(nodeType);
    const node: NodeDescriptor = {
      id,
      type: nodeType,
      metadata: {
        title,
        visual: {
          x: toGridSize(graphLocation.x - (createAtCenter ? 130 : 0)),
          y: toGridSize(graphLocation.y - (createAtCenter ? 20 : 0)),
        },
      },
    };

    if (connectedTo) {
      const edge: Edge = {
        from: connectedTo,
        to: id,
      };

      this.dispatchEvent(
        new AddNodeWithEdgeEvent(
          node,
          edge,
          targetGraphId === MAIN_BOARD_ID ? null : targetGraphId
        )
      );
    } else {
      this.dispatchEvent(
        new MultiEditEvent(
          [
            {
              type: "addnode",
              graphId: targetGraphId === MAIN_BOARD_ID ? "" : targetGraphId,
              node,
            },
          ],
          `Add step: ${title}`
        )
      );
    }
  }

  #dragStart: DOMPoint | null = null;
  #dragRect: DOMRect | null = null;
  #clickRect: DOMRect | null = null;
  #isToggleSelection = false;
  #isAdditiveSelection = false;
  #refocusSelf = false;
  #onPointerDown(evt: PointerEvent) {
    if (this.#editorControls.value) {
      this.#editorControls.value.hidePickers();
    }

    this.#dragStart = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    );

    if (this.interactionMode === "pan") {
      this.isDragPanning = true;
      return;
    }

    this.#refocusSelf = true;
    this.#dragRect = new DOMRect();
    this.#isToggleSelection = isCtrlCommand(evt);
    this.#isAdditiveSelection = evt.shiftKey;
    this.#updateDragRect(evt);
    this.interactionMode = "selection";
    this.tick++;

    // If the interaction is with the renderer, go into selection mode proper.
    const [top, ...rest] = evt.composedPath();
    if (top !== this) {
      // If the user has clicked on an entity, change the behavior to a click.
      const nearestEntity =
        top instanceof Entity ? top : rest.find((el) => el instanceof Entity);
      if (
        nearestEntity &&
        (!nearestEntity.selected || this.#isToggleSelection)
      ) {
        this.#clickRect = DOMRect.fromRect(this.#dragRect);
        this.#clickRect.x -= 5;
        this.#clickRect.y -= 5;
        this.#clickRect.width = 10;
        this.#clickRect.height = 10;
        this.#dragRect = null;
        return;
      }

      this.interactionMode = "move";
    }
  }

  #onPointerMove(evt: PointerEvent) {
    // This event informs the Visual Editor's root handler about the last known
    // cursor location for things like copy-paste. We adjust it with the
    // camera's transform before sending it so that they are renderer
    // coordinates rather than screen coordinates.
    const location = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    ).matrixTransform(this.camera.transform);
    this.dispatchEvent(
      new EditorPointerPositionChangeEvent(location.x, location.y)
    );

    if (!this.#dragStart) {
      return;
    }

    if (this.interactionMode === "pan") {
      const delta = new DOMPoint(
        evt.clientX - this.#boundsForInteraction.left - this.#dragStart.x,
        evt.clientY - this.#boundsForInteraction.top - this.#dragStart.y
      );

      if (!this.camera.baseTransform) {
        this.camera.baseTransform = DOMMatrix.fromMatrix(this.camera.transform);
      }

      this.camera.transform.e =
        this.camera.baseTransform.e - delta.x * this.camera.transform.a;
      this.camera.transform.f =
        this.camera.baseTransform.f - delta.y * this.camera.transform.a;
    } else if (this.#dragRect) {
      this.#updateDragRect(evt);
    }

    this.tick++;
  }

  #onPointerUp() {
    this.#dragStart = null;
    this.#dragRect = null;

    if (this.interactionMode !== "pan") {
      this.interactionMode = "inert";
    }
    this.#isAdditiveSelection = false;
    this.#isToggleSelection = false;
    this.camera.baseTransform = null;
    this.isDragPanning = false;

    if (!this.#refocusSelf) {
      return;
    }

    // Because the drag event will trigger a selection change and, with it, a
    // re-render, we will lose focus on the renderer. As such when the pointer
    // comes back up we schedule a focus call to restore it.
    requestAnimationFrame(() => {
      this.#refocusSelf = false;
      this.focus();
    });
  }

  #updateDragRect(evt: PointerEvent) {
    if (!this.#dragStart || !this.#dragRect) {
      return;
    }

    const dragCurrent = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    );
    const x = Math.min(this.#dragStart.x, dragCurrent.x);
    const y = Math.min(this.#dragStart.y, dragCurrent.y);
    const width = Math.abs(this.#dragStart.x - dragCurrent.x);
    const height = Math.abs(this.#dragStart.y - dragCurrent.y);

    this.#dragRect.x = x;
    this.#dragRect.y = y;
    this.#dragRect.width = width;
    this.#dragRect.height = height;
  }

  #onWheel(evt: WheelEvent) {
    evt.preventDefault();

    if (!this.camera) {
      return;
    }

    this.#removeEffect("camera");

    // Only allow pan-drag and zoom when there are no other actions going on.
    if (this.interactionMode !== "inert") {
      return;
    }

    if (isCtrlCommand(evt) || evt.ctrlKey) {
      const currentScale = this.camera.transform.a;
      const newScale = currentScale * (1 - evt.deltaY / this.zoomFactor);

      let delta = currentScale / newScale;
      if (
        currentScale * delta < this.minScale ||
        currentScale * delta > this.maxScale
      ) {
        delta = 1;
      }

      const offsetX = evt.clientX - this.#boundsForInteraction.x;
      const offsetY = evt.clientY - this.#boundsForInteraction.y;

      this.camera.transform.translateSelf(offsetX, offsetY);
      this.camera.transform.scaleSelf(delta, delta);
      this.camera.transform.translateSelf(-offsetX, -offsetY);
    } else {
      this.camera.transform.translateSelf(evt.deltaX, evt.deltaY);
    }

    this.tick++;
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (
      changedProperties.size === 1 &&
      changedProperties.has("selectionState") &&
      this.selectionState
    ) {
      if (
        this.selectionState.selectionChangeId ===
        changedProperties.get("selectionState")?.selectionChangeId
      ) {
        console.log("Ignoring selection state change");
        return false;
      }
    }

    if (
      changedProperties.size === 1 &&
      changedProperties.has("highlightState") &&
      this.highlightState
    ) {
      if (
        this.highlightState.highlightChangeId ===
        changedProperties.get("highlightState")?.highlightChangeId
      ) {
        console.log("Ignoring highlight state change");
        return false;
      }
    }

    return true;
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (this.#fitToViewPre) {
      this.#fitToViewPre = false;
      this.fitToView(false);
    }

    if (this.#attemptAdjustToNewBounds) {
      this.#attemptAdjustToNewBounds = false;
      this.#removeEffect("camera");
      this.#adjustToNewBounds();
    }

    if (changedProperties.has("cullPadding")) {
      if (this.cullPadding >= 0) {
        this.style.setProperty("--cull-padding", null);
      } else {
        this.style.setProperty("--cull-padding", `${this.cullPadding}px`);
      }
    }

    if (changedProperties.has("selectionState") && this.selectionState) {
      for (const [graphId, graph] of this.#graphs) {
        const selectionState =
          this.selectionState.selectionState.graphs.get(graphId);
        if (selectionState) {
          graph.selectionState = selectionState;
        } else {
          graph.selectionState = createEmptyGraphSelectionState();
        }
      }
    }

    if (changedProperties.has("highlightState")) {
      if (this.highlightState) {
        for (const [graphId, graph] of this.#graphs) {
          const highlightState =
            this.highlightState.highlightState.graphs?.get(graphId);
          if (highlightState) {
            graph.highlightState = highlightState;
          } else {
            graph.highlightState = createEmptyGraphHighlightState();
          }

          graph.highlightType = this.highlightState.highlightType;
        }
      } else {
        for (const graph of this.#graphs.values()) {
          graph.highlightState = createEmptyGraphHighlightState();
        }
      }
    }

    if (changedProperties.has("topGraphResult")) {
      const mainGraph = this.#graphs.get(MAIN_BOARD_ID);
      if (mainGraph) {
        mainGraph.highlightActivity(this.topGraphResult);
      }
    }

    if (
      (changedProperties.has("graph") ||
        changedProperties.has("graphTopologyUpdateId") ||
        changedProperties.has("allowEdgeAttachmentMove")) &&
      this.graph &&
      this.camera
    ) {
      const graphUrl = new URL(this.graph.raw().url ?? window.location.href);

      // Main graph.
      let mainGraph = this.#graphs.get(MAIN_BOARD_ID);
      if (!mainGraph) {
        mainGraph = new Graph(MAIN_BOARD_ID);
        this.#graphs.set(MAIN_BOARD_ID, mainGraph);
      }

      // When going from an empty main graph to something populated ensure that
      // we re-center the graph to the view.
      const entitiesBefore = mainGraph.nodes.length + mainGraph.assets.size;
      const entitiesAfter =
        this.graph.nodes().length + this.graph.assets().size;
      if (entitiesBefore === 0 && entitiesAfter > 0) {
        this.#fitToViewPost = true;
      }

      mainGraph.url = graphUrl;
      mainGraph.boundsLabel = this.graph.raw().title ?? "Untitled";
      mainGraph.nodes = this.graph.nodes();
      mainGraph.edges = this.graph.edges();
      mainGraph.rendererState = this.state;
      if (this.showAssetsInGraph) {
        mainGraph.assets = this.graph.assets();
        mainGraph.assetEdges = this.graph.assetEdges();
      }

      mainGraph.allowEdgeAttachmentMove = this.allowEdgeAttachmentMove;
      mainGraph.resetTransform();

      // Subgraphs.
      for (const [id, graph] of Object.entries(this.graph.graphs() ?? {})) {
        if (graph.nodes().length === 0) {
          continue;
        }

        let subGraph = this.#graphs.get(id);
        if (!subGraph) {
          subGraph = new Graph(id);
          this.#graphs.set(id, subGraph);
        }

        subGraph.url = graphUrl;
        subGraph.boundsLabel = graph.raw().title ?? "Custom Tool";
        subGraph.nodes = graph.nodes();
        subGraph.edges = graph.edges();
        subGraph.rendererState = this.state;
        subGraph.allowEdgeAttachmentMove = this.allowEdgeAttachmentMove;
        subGraph.resetTransform();
      }

      // Remove any stale graphs.
      const subGraphs = this.graph.graphs() ?? {};
      for (const graphId of this.#graphs.keys()) {
        if (graphId === MAIN_BOARD_ID || subGraphs[graphId]) {
          continue;
        }

        this.#graphs.delete(graphId);
      }
    }

    if (
      (changedProperties.has("tick") ||
        changedProperties.has("_boundsDirty") ||
        changedProperties.has("interactionMode") ||
        changedProperties.has("graphTopologyUpdateId")) &&
      this.graph &&
      this.camera
    ) {
      const inverseCameraMatrix = this.camera.transform.inverse();
      for (const graph of this.#graphs.values()) {
        graph.updateEntity(inverseCameraMatrix);

        if (this.interactionMode === "selection") {
          // Drag-select.
          if (this.#dragRect) {
            graph.selectInsideOf(
              this.#dragRect,
              0,
              this.#isAdditiveSelection,
              false
            );
          } else if (this.#clickRect) {
            // Click-select.
            graph.selectAt(
              this.#clickRect,
              0,
              this.#isAdditiveSelection,
              this.#isToggleSelection
            );
          }

          // Expands node selections to include edges.
          if (this.expandSelections) {
            graph.expandSelections();
          }

          this.#updateSelectionFromGraph(graph);
        }

        if (this.camera?.bounds) {
          graph.cullOutsideOf(this.camera.bounds, this.cullPadding);
        }
      }
    }

    this.#clickRect = null;
    this._boundsDirty.clear();
  }

  protected updated(_changedProperties: PropertyValues): void {
    if (!this.#fitToViewPost) {
      return;
    }

    this.#fitToViewPost = false;
    requestAnimationFrame(() => {
      this.fitToView(false);
    });
  }

  #adjustToNewBounds() {
    if (!this.camera) {
      return;
    }

    this.camera.transform.translateSelf(
      (this.#lastBoundsForInteraction.width -
        this.#boundsForInteraction.width) *
        0.5,
      (this.#lastBoundsForInteraction.height -
        this.#boundsForInteraction.height) *
        0.5
    );
  }

  zoom(animated = false, requestedDelta = 0) {
    const currentScale = this.camera.transform.a;
    const newScale = currentScale * (1 - requestedDelta);

    let delta = currentScale / newScale;
    if (
      currentScale * delta < this.minScale ||
      currentScale * delta > this.maxScale
    ) {
      delta = 1;
    }

    const targetMatrix = this.camera.transform.translate(0, 0); // Clone.
    const offsetX =
      this.#boundsForInteraction.width * 0.5 - this.#boundsForInteraction.x;
    const offsetY =
      this.#boundsForInteraction.height * 0.5 - this.#boundsForInteraction.y;

    targetMatrix.translateSelf(offsetX, offsetY);
    targetMatrix.scaleSelf(delta, delta);
    targetMatrix.translateSelf(-offsetX, -offsetY);

    this.#updateCamera(animated, targetMatrix);
  }

  fitToView(animated = true, retryOnEmpty = false) {
    if (!this.#graphs || !this.#boundsForInteraction || !this.camera) {
      return;
    }

    const allGraphBounds = calculateBounds(this.#graphs);
    if (allGraphBounds.width === 0) {
      if (retryOnEmpty) {
        requestAnimationFrame(() => {
          this.fitToView(animated);
        });
      }
      return;
    }

    const targetMatrix = this.#calculateCameraMatrixFromBounds(allGraphBounds);
    this.#updateCamera(animated, targetMatrix);
  }

  #updateCamera(animated = false, targetMatrix: DOMMatrix) {
    if (!animated) {
      this.camera.transform = targetMatrix;
    } else {
      this.#addEffect("camera", () => {
        if (!this.camera) {
          this.#removeEffect("camera");
          return;
        }

        const EASING = 10;
        const THRESHOLD = 0.001;
        const current = this.camera.transform.translate(0, 0); // Clone.

        current.a += (targetMatrix.a - current.a) / EASING;
        current.b += (targetMatrix.b - current.b) / EASING;
        current.c += (targetMatrix.c - current.c) / EASING;
        current.d += (targetMatrix.d - current.d) / EASING;
        current.e += (targetMatrix.e - current.e) / EASING;
        current.f += (targetMatrix.f - current.f) / EASING;

        if (
          Math.abs(current.a - targetMatrix.a) < THRESHOLD &&
          Math.abs(current.b - targetMatrix.b) < THRESHOLD &&
          Math.abs(current.c - targetMatrix.c) < THRESHOLD &&
          Math.abs(current.d - targetMatrix.d) < THRESHOLD &&
          Math.abs(current.e - targetMatrix.e) < THRESHOLD &&
          Math.abs(current.f - targetMatrix.f) < THRESHOLD
        ) {
          this.camera.transform = targetMatrix;
          this.tick++;
          this.#removeEffect("camera");
          return;
        }

        this.camera.transform = current;
        this.tick++;
      });
    }
  }

  #runningEffects = false;
  #runEffects() {
    const runEffects = () => {
      for (const effect of this.#effects.values()) {
        effect.call(this);
      }

      if (this.#effects.size === 0) {
        this.#runningEffects = false;
        return;
      }

      requestAnimationFrame(runEffects);
    };

    if (this.#runningEffects) {
      return;
    }

    requestAnimationFrame(runEffects);
  }

  #calculateCameraMatrixFromBounds(bounds: DOMRect) {
    const targetMatrix = new DOMMatrix();

    const delta = Math.min(
      (this.#boundsForInteraction.width - 2 * this.graphFitPadding) /
        bounds.width,
      (this.#boundsForInteraction.height - 2 * this.graphFitPadding) /
        bounds.height,
      1
    );

    if (delta === 0) {
      return targetMatrix;
    }

    const invDelta = clamp(1 / delta, this.minScale, this.maxScale);
    const pivot = new DOMPoint(
      this.#boundsForInteraction.width * 0.5,
      this.#boundsForInteraction.height * 0.5
    );

    targetMatrix
      .translateSelf(
        bounds.x - (this.#boundsForInteraction.width - bounds.width) * 0.5,
        bounds.y - (this.#boundsForInteraction.height - bounds.height) * 0.5
      )
      .translateSelf(pivot.x, pivot.y)
      .scaleSelf(invDelta, invDelta)
      .translateSelf(-pivot.x, -pivot.y);

    // Also ensure that the matrix values remain positive.
    targetMatrix.a = Math.max(targetMatrix.a, 0);
    targetMatrix.b = Math.max(targetMatrix.b, 0);
    targetMatrix.c = Math.max(targetMatrix.c, 0);
    targetMatrix.d = Math.max(targetMatrix.d, 0);

    return targetMatrix;
  }

  #applyMoveToSelection(
    eventX: number,
    eventY: number,
    deltaX: number,
    deltaY: number,
    hasSettled: boolean
  ) {
    if (!this.selectionState || !this.graph) {
      return;
    }

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    let moveGraph = this.#graphs.get(MOVE_GRAPH_ID);
    if (!moveGraph) {
      moveGraph = new Graph(MOVE_GRAPH_ID);

      const nodes: InspectableNode[] = [];
      for (const [graphId, graph] of this.selectionState.selectionState
        .graphs) {
        for (const node of graph.nodes) {
          const targetGraph =
            graphId === MAIN_BOARD_ID
              ? this.graph
              : this.graph.graphs()?.[graphId];
          if (!targetGraph) {
            continue;
          }

          const inspectableNode = targetGraph.nodeById(node);
          if (!inspectableNode) {
            continue;
          }

          nodes.push(inspectableNode);
        }
      }

      moveGraph.nodes = nodes;
      this.#graphs.set(MOVE_GRAPH_ID, moveGraph);
      this.tick++;
    }

    moveGraph.applyTranslationToNodes(deltaX, deltaY, hasSettled);

    if (hasSettled) {
      this.#graphs.delete(MOVE_GRAPH_ID);

      // Finding the natural intersection for the selection.
      const x = eventX - this.#boundsForInteraction.x;
      const y = eventY - this.#boundsForInteraction.y;
      const addLocation = new DOMRect(x, y, 0, 0);
      let targetGraphId = MAIN_BOARD_ID;
      for (const [graphId, graph] of this.#graphs) {
        if (graphId === MAIN_BOARD_ID) {
          continue;
        }

        if (graph.intersects(addLocation, 0)) {
          targetGraphId = graphId;
          break;
        }
      }

      // Flatten the selection down
      const moveNodes = new Map<GraphIdentifier, NodeIdentifier[]>();
      for (const [graphId, graph] of this.selectionState.selectionState
        .graphs) {
        let moveNodeGraphItems = moveNodes.get(graphId);
        if (!moveNodeGraphItems) {
          moveNodeGraphItems = [];
          moveNodes.set(graphId, moveNodeGraphItems);
        }

        for (const node of graph.nodes) {
          moveNodeGraphItems.push(node);
        }
      }

      this.dispatchEvent(
        new MoveNodesEvent(
          moveNodes,
          targetGraphId,
          new DOMPoint(deltaX, deltaY)
        )
      );
    }
  }

  #applyTranslationToSelection(x: number, y: number, hasSettled: boolean) {
    if (!this.selectionState) {
      return;
    }

    for (const graphId of this.selectionState.selectionState.graphs.keys()) {
      const graph = this.#graphs.get(graphId);
      if (!graph) {
        continue;
      }

      graph.applyTranslationToSelection(x, y, hasSettled);
    }

    // When the dragging settles, send out the update on all the node locations
    // so they can be persisted.
    const hasMoved = x !== 0 || y !== 0;
    if (hasSettled && hasMoved) {
      this.#emitSettledLocationEdits();
    }
  }

  #emitSettledLocationEdits() {
    if (!this.selectionState) {
      return;
    }

    const edits: EditSpec[] = [];

    for (const graphId of this.selectionState.selectionState.graphs.keys()) {
      const graph = this.#graphs.get(graphId);
      const graphSelection =
        this.selectionState.selectionState.graphs.get(graphId);
      if (!graph || !graphSelection) {
        continue;
      }

      for (const nodeId of graphSelection.nodes) {
        // Find the InspectableNode and the GraphNode entity and create the
        // updated metadata from the two.
        const graphNode = graph.nodes.find(
          (node) => node.descriptor.id === nodeId
        );
        const graphNodeEntity = graph.entities.get(nodeId);
        if (!graphNode || !graphNodeEntity) {
          continue;
        }

        const metadata = { ...(graphNode.metadata() ?? {}) };
        metadata.visual ??= {};

        const visual = metadata.visual as Record<string, number>;
        visual.x = toGridSize(graph.transform.e + graphNodeEntity.transform.e);
        visual.y = toGridSize(graph.transform.f + graphNodeEntity.transform.f);

        const editGraphId = graphId === MAIN_BOARD_ID ? "" : graphId;
        edits.push({
          type: "changemetadata",
          graphId: editGraphId,
          id: nodeId,
          metadata,
        });
      }

      for (const assetPath of graphSelection.assets) {
        // Find the InspectableNode and the GraphNode entity and create the
        // updated metadata from the two.
        const graphAsset = graph.assets.get(assetPath);
        const graphAssetEntity = graph.entities.get(assetPath);
        if (!graphAsset || !graphAssetEntity) {
          continue;
        }

        const visual = (graphAsset.visual ?? {}) as Record<string, NodeValue>;
        visual.x = toGridSize(graph.transform.e + graphAssetEntity.transform.e);
        visual.y = toGridSize(graph.transform.f + graphAssetEntity.transform.f);

        const metadata: AssetMetadata = {
          title: graphAsset.title,
          type: graphAsset.type,
          description: graphAsset.description,
          subType: graphAsset.subType,
          visual,
        };

        edits.push({
          type: "changeassetmetadata",
          path: assetPath,
          metadata,
        });
      }
    }

    this.dispatchEvent(new MultiEditEvent(edits, "Update selection position"));
  }

  #updateSelectionFromGraph(graph: Graph, createNewSelection = false) {
    const newState = createNewSelection
      ? createEmptyWorkspaceSelectionState()
      : (this.selectionState?.selectionState ??
        createEmptyWorkspaceSelectionState());

    if (graph.selectionState) {
      newState.graphs.set(graph.graphId, graph.selectionState);
    }

    const selectionChangeId = createWorkspaceSelectionChangeId();

    this.dispatchEvent(
      new WorkspaceSelectionStateEvent(
        selectionChangeId,
        newState,
        !this.#isAdditiveSelection,
        /** animated **/ false
      )
    );
  }

  render() {
    if (!this.#graphs || !this.camera) {
      return nothing;
    }

    const hasNoAssets = (this.graph?.assets() ?? new Map()).size === 0;
    const hasNoSubGraphs = Object.keys(this.graph?.graphs() ?? {}).length === 0;
    const subGraphsAreEmpty = Object.values(this.graph?.graphs() ?? {}).every(
      (graph) => graph.nodes().length === 0
    );
    const showDefaultAdd =
      this.graph?.nodes().length === 0 &&
      hasNoAssets &&
      (hasNoSubGraphs || subGraphsAreEmpty);

    this.camera.showBounds = this.debug;

    let selectionRectangle: HTMLTemplateResult | symbol = nothing;
    if (this.interactionMode === "selection" && this.#dragRect) {
      selectionRectangle = html`<div
        style=${styleMap({
          left: `${this.#dragRect.x}px`,
          top: `${this.#dragRect.y}px`,
          width: `${this.#dragRect.width}px`,
          height: `${this.#dragRect.height}px`,
        })}
        id="selection"
      ></div>`;
    }

    return [
      html`${repeat(
        this.#graphs,
        ([graphId]) => graphId,
        ([graphId, graph]) => {
          if (!this.camera) {
            return nothing;
          }

          graph.showBounds = this.debug;

          return html`<div
            @bbnodeconfigurationrequest=${(
              evt: NodeConfigurationRequestEvent
            ) => {
              this.dispatchEvent(
                new NodeConfigurationUpdateRequestEvent(
                  evt.nodeId,
                  graphId === MAIN_BOARD_ID ? "" : graphId,
                  null,
                  null,
                  undefined,
                  undefined,
                  false,
                  evt.bounds
                )
              );
            }}
            @bbnodeselect=${(evt: NodeSelectEvent) => {
              if (!this.#editorControls.value || !evt.connectedTo) {
                return;
              }

              this.#editorControls.value.showComponentLibraryAt(
                evt.x - this.#boundsForInteraction.x,
                evt.y - this.#boundsForInteraction.y,
                evt.connectedTo,
                graphId
              );
            }}
            @bbdragconnectorstart=${(evt: DragConnectorStartEvent) => {
              this.dragConnector.offset = new DOMPoint(
                this.#boundsForInteraction.x,
                this.#boundsForInteraction.y
              );

              this.dragConnector.start = evt.location;
              this.dragConnector.connectorType = evt.connectorType;

              if (evt.connectorType === "node") {
                const { nodeId, graphId, portId } = collectNodeIds(evt, "out");
                if (!nodeId || !graphId || !portId) {
                  console.warn(
                    "Unable to connect - no node/graph/port combination found"
                  );
                  return;
                }

                this.dragConnector.graphId = graphId;
                this.dragConnector.nodeId = nodeId;
                this.dragConnector.portId = portId;

                this.dragConnector.addEventListener(
                  "bbnodeselect",
                  (evt: Event) => {
                    if (!this.#editorControls.value || !nodeId) {
                      return;
                    }

                    const selectEvent = evt as NodeSelectEvent;
                    this.#editorControls.value.showComponentLibraryAt(
                      selectEvent.x - this.#boundsForInteraction.x,
                      selectEvent.y - this.#boundsForInteraction.y,
                      nodeId,
                      graphId
                    );
                  },
                  { once: true }
                );
              } else if (evt.connectorType === "asset") {
                const { graphId, assetPath } = collectAssetIds(evt);
                this.dragConnector.graphId = graphId;
                this.dragConnector.assetPath = assetPath;
              }
            }}
            @bbselectgraphcontents=${(evt: SelectGraphContentsEvent) => {
              const graph = this.#graphs.get(evt.graphId);
              if (!graph) {
                return;
              }

              this.#updateSelectionFromGraph(graph, true);
            }}
            @bbselectionmove=${(evt: SelectionMoveEvent) => {
              this.#applyMoveToSelection(
                evt.eventX,
                evt.eventY,
                evt.deltaX,
                evt.deltaY,
                evt.hasSettled
              );
            }}
            @bbselectiontranslate=${(evt: SelectionTranslateEvent) => {
              if (this.interactionMode === "pan") {
                return;
              }

              this.#applyTranslationToSelection(evt.x, evt.y, evt.hasSettled);

              this._boundsDirty = new Set([
                ...this._boundsDirty,
                graph.boundsLabel,
              ]);
            }}
            @bbgraphedgeattachmentmove=${(
              evt: GraphEdgeAttachmentMoveEvent
            ) => {
              this.dispatchEvent(
                new EdgeAttachmentMoveEvent(
                  graphId,
                  evt.edge,
                  evt.which,
                  evt.value
                )
              );
            }}
            @bbnodeboundsupdaterequest=${() => {
              this._boundsDirty = new Set([
                ...this._boundsDirty,
                graph.boundsLabel,
              ]);
            }}
          >
            ${graph}
          </div>`;
        }
      )}
      </div>`,
      html`<bb-editor-controls
        ${ref(this.#editorControls)}
        .boardServerKits=${this.boardServerKits}
        .graph=${this.graph}
        .graphStore=${this.graphStore}
        .graphStoreUpdateId=${this.graphStoreUpdateId}
        .mainGraphId=${this.mainGraphId}
        .showDefaultAdd=${showDefaultAdd}
        .showExperimentalComponents=${this.showExperimentalComponents}
        @wheel=${(evt: WheelEvent) => {
          evt.stopImmediatePropagation();
        }}
        @bbnodeadd=${(evt: NodeAddEvent) => {
          this.#createNode(
            evt.nodeType,
            evt.createAtCenter,
            evt.x,
            evt.y,
            evt.connectedTo,
            evt.subGraphId
          );
        }}
        @bbzoomin=${(evt: ZoomInEvent) => {
          this.zoom(evt.animate, -0.25);
        }}
        @bbzoomout=${(evt: ZoomOutEvent) => {
          this.zoom(evt.animate, 0.25);
        }}
        @bbzoomtofit=${(evt: ZoomToFitEvent) => {
          this.fitToView(evt.animate);
        }}
        @bbcreatenewasset=${(evt: CreateNewAssetsEvent) => {
          this.#handleNewAssets(evt);
        }}
      ></bb-editor-controls>`,
      this.camera,
      html`<div
        id="overlay"
        class=${classMap({ active: this.cullPadding < 0 })}
      ></div>`,
      selectionRectangle,
      this.dragConnector,
    ];
  }
}
