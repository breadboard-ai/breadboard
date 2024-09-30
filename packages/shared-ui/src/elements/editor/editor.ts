/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommentNode,
  Edge,
  EditSpec,
  GraphDescriptor,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableGraph,
  InspectableNodePorts,
  InspectableRun,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlerMetadata,
  NodeValue,
  SubGraphs,
} from "@google-labs/breadboard";
import {
  HTMLTemplateResult,
  LitElement,
  PropertyValues,
  css,
  html,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import {
  CommentEditRequestEvent,
  EdgeChangeEvent,
  EdgeValueSelectedEvent,
  GraphCommentEditRequestEvent,
  GraphEdgeAttachEvent,
  GraphEdgeDetachEvent,
  GraphEdgeValueSelectedEvent,
  GraphEntityRemoveEvent,
  GraphHideTooltipEvent,
  GraphInitialDrawEvent,
  GraphInteractionEvent,
  GraphNodeActivitySelectedEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEditEvent,
  GraphNodesVisualUpdateEvent,
  GraphShowTooltipEvent,
  HideTooltipEvent,
  KitNodeChosenEvent,
  MultiEditEvent,
  NodeActivitySelectedEvent,
  NodeConfigurationUpdateRequestEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeTypeRetrievalErrorEvent,
  RedoEvent,
  RunEvent,
  SaveAsEvent,
  SaveEvent,
  ShowTooltipEvent,
  StopEvent,
  SubGraphChosenEvent,
  SubGraphCreateEvent,
  SubGraphDeleteEvent,
  ToggleBoardActivityEvent,
  UndoEvent,
} from "../../events/events.js";
import { GraphEdge } from "./graph-edge.js";
import { GraphRenderer } from "./graph-renderer.js";
import type { NodeSelector } from "./node-selector.js";
import { edgeToString } from "./utils.js";

const ZOOM_KEY = "bb-editor-zoom-to-highlighted-node-during-runs";
const DATA_TYPE = "text/plain";
const PASTE_OFFSET = 50;

import { TopGraphRunResult } from "../../types/types.js";
import { GraphAssets } from "./graph-assets.js";
import { classMap } from "lit/directives/class-map.js";

function getDefaultConfiguration(type: string): NodeConfiguration | undefined {
  if (type !== "input" && type !== "output") {
    return undefined;
  }

  return {
    schema: {
      properties: {
        context: {
          type: "array",
          title: "Context",
          items: {
            type: "object",
            examples: [],
            behavior: ["llm-content"],
            default:
              type === "input"
                ? '{"role":"user","parts":[{"text":""}]}'
                : "null",
          },
        },
      },
      type: "object",
      required: [],
    },
  };
}

type EditedNode = {
  editAction: "add" | "update";
  id: string;
};

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  run: InspectableRun | null = null;

  @property()
  boardId: number = -1;

  @property()
  capabilities: false | GraphProviderCapabilities = false;

  @property()
  extendedCapabilities: false | GraphProviderExtendedCapabilities = false;

  @property()
  canUndo = false;

  @property()
  canRedo = false;

  @property()
  collapseNodesByDefault = false;

  @property()
  hideSubboardSelectorWhenEmpty = false;

  @property()
  showNodeShortcuts = true;

  @property()
  topGraphResult: TopGraphRunResult | null = null;

  @state()
  nodeValueBeingEdited: EditedNode | null = null;

  @state()
  defaultConfiguration: NodeConfiguration | null = null;

  @property({ reflect: true })
  invertZoomScrollDirection = false;

  @property()
  showNodeTypeDescriptions = true;

  @property()
  showNodePreviewValues = true;

  @property()
  assetPrefix = "";

  @property()
  showControls = true;

  @property()
  readOnly = false;

  @property()
  showReadOnlyOverlay = false;

  @property()
  highlightInvalidWires = false;

  @property()
  showExperimentalComponents = false;

  @property()
  zoomToHighlightedNodeDuringRuns = false;

  @property()
  set showPortTooltips(value: boolean) {
    this.#graphRenderer.showPortTooltips = value;
  }

  get showPortTooltips() {
    return this.#graphRenderer.showPortTooltips;
  }

  @state()
  showOverflowMenu = false;

  #graphRenderer = new GraphRenderer();
  // Incremented each time a graph is updated, used to avoid extra work
  // inspecting ports when the graph is updated.
  #graphVersion = 0;
  #lastBoardId: number = -1;
  #lastSubGraphId: string | null = null;

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onResizeBound = this.#onResize.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onGraphNodesVisualUpdateBound = this.#onGraphNodesVisualUpdate.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
  #onGraphEntityRemoveBound = this.#onGraphEntityRemove.bind(this);
  #onGraphNodeEditBound = this.#onGraphNodeEdit.bind(this);
  #onGraphEdgeValueSelectedBound = this.#onGraphEdgeValueSelected.bind(this);
  #onGraphNodeActivitySelectedBound =
    this.#onGraphNodeActivitySelected.bind(this);
  #onGraphInteractionBound = this.#onGraphInteraction.bind(this);
  #onGraphShowTooltipBound = this.#onGraphShowTooltip.bind(this);
  #onGraphHideTooltipBound = this.#onGraphHideTooltip.bind(this);
  #onGraphCommentEditRequestBound = this.#onGraphCommentEditRequest.bind(this);

  #top = 0;
  #left = 0;
  #addButtonRef: Ref<HTMLInputElement> = createRef();
  #nodeSelectorRef: Ref<NodeSelector> = createRef();
  #activityMarkerRef: Ref<HTMLElement> = createRef();

  #writingToClipboard = false;
  #readingFromClipboard = false;
  #lastX = 0;
  #lastY = 0;
  #pasteCount = 0;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--bb-ui-50);
      overflow: auto;
      position: relative;
      user-select: none;
      pointer-events: auto;
      width: 100%;
      height: 100%;
      position: relative;
    }

    bb-node-selector {
      visibility: hidden;
      pointer-events: none;
      position: absolute;
      bottom: var(--bb-grid-size-12);
      left: 0;
    }

    #nodes {
      height: calc(var(--bb-grid-size) * 9);
      position: absolute;
      bottom: calc(var(--bb-grid-size) * 3);
      left: calc(var(--bb-grid-size) * 3);
      border-radius: 50px;
      border: 1px solid #d9d9d9;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 var(--bb-grid-size) 0 var(--bb-grid-size-3);
    }

    #shortcut-add-comment,
    #shortcut-add-specialist,
    #shortcut-add-human,
    #shortcut-add-looper {
      font-size: 0;
      width: 20px;
      height: 20px;
      background: var(--bb-neutral-0);
      margin-right: calc(var(--bb-grid-size) * 2);
      border: none;
      cursor: grab;
    }

    #shortcut-add-specialist {
      background: var(--bb-neutral-0) var(--bb-icon-smart-toy) center center /
        20px 20px no-repeat;
    }

    #shortcut-add-human {
      background: var(--bb-neutral-0) var(--bb-icon-human) center center / 20px
        20px no-repeat;
    }

    #shortcut-add-looper {
      background: var(--bb-neutral-0) var(--bb-icon-laps) center center / 20px
        20px no-repeat;
    }

    #shortcut-add-comment {
      background: var(--bb-neutral-0) var(--bb-icon-edit) center center / 20px
        20px no-repeat;
    }

    #shortcut-add-specialist:active,
    #shortcut-add-human:active,
    #shortcut-add-looper:active {
      cursor: grabbing;
    }

    label[for="add-node"] {
      font-size: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    label[for="add-node"]::before {
      content: "";
      width: 24px;
      height: 24px;
      background: var(--bb-ui-100) var(--bb-icon-more-vert) center center / 20px
        20px no-repeat;
      border-radius: 50%;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      opacity: 0.5;
    }

    label[for="add-node"]:hover::before {
      opacity: 1;
    }

    #add-node {
      display: none;
    }

    #add-node:checked ~ bb-node-selector {
      visibility: visible;
      pointer-events: auto;
    }

    #add-node:checked ~ label[for="add-node"] {
      opacity: 1;
    }

    bb-graph-renderer {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
    }

    #controls {
      height: var(--bb-grid-size-9);
      position: absolute;
      top: var(--bb-grid-size-3);
      left: var(--bb-grid-size-3);
      background: #fff;
      border-radius: 40px;
      padding: 0 var(--bb-grid-size) 0 var(--bb-grid-size-3);

      border: 1px solid var(--bb-neutral-300);
      display: flex;
      align-items: center;
    }

    #controls button {
      margin-left: calc(var(--bb-grid-size) * 2);
    }

    #controls button:first-of-type,
    #controls .divider + button {
      margin-left: 0;
    }

    #debug {
      width: 140px;

      height: calc(var(--bb-grid-size) * 9);
      position: absolute;
      bottom: calc(var(--bb-grid-size) * 3);
      right: calc(var(--bb-grid-size) * 2);

      background: var(--bb-ui-600) var(--bb-icon-debug-inverted) 12px center /
        20px 20px no-repeat;
      color: #fff;
      border-radius: 20px;
      border: none;
      font-size: var(--bb-label-large);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-5) var(--bb-grid-size-2)
        var(--bb-grid-size-9);
      margin-right: var(--bb-grid-size-2);
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #debug:hover,
    #debug:focus {
      opacity: 1;
    }

    #debug[disabled] {
      opacity: 0.4;
      cursor: auto;
    }

    #reset-layout,
    #zoom-to-fit,
    #undo,
    #redo,
    #save-board,
    #overflow {
      width: 20px;
      height: 20px;
      background: center center no-repeat;
      background-size: 20px 20px;
      font-size: 0;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      opacity: 0.5;
      border: none;
    }

    #overflow {
      border-radius: 50%;
      width: 24px;
      height: 24px;
    }

    #reset-layout[disabled],
    #zoom-to-fit[disabled],
    #undo[disabled],
    #redo[disabled],
    #save-board[disabled],
    #overflow[disabled] {
      opacity: 0.45;
    }

    #reset-layout {
      background-image: var(--bb-icon-reset-nodes);
    }

    #zoom-to-fit {
      background-image: var(--bb-icon-fit);
    }

    #undo {
      margin: 0;
      background-image: var(--bb-icon-undo);
    }

    #redo {
      background-image: var(--bb-icon-redo);
    }

    #save-board {
      background-image: var(--bb-icon-save);
    }

    #overflow {
      background: var(--bb-ui-100) var(--bb-icon-more-vert) center center / 20px
        20px no-repeat;
    }

    #reset-layout:not([disabled]):hover,
    #zoom-to-fit:not([disabled]):hover,
    #undo:not([disabled]):hover,
    #redo:not([disabled]):hover,
    #save-board:not([disabled]):hover,
    #overflow:not([disabled]):hover,
    #reset-layout:not([disabled]):focus,
    #zoom-to-fit:not([disabled]):focus,
    #undo:not([disabled]):focus,
    #redo:not([disabled]):focus,
    #save-board:not([disabled]):focus,
    #overflow:not([disabled]):focus {
      transition-duration: 0.1s;
      opacity: 1;
      cursor: pointer;
    }

    .divider {
      width: 1px;
      height: calc(var(--bb-grid-size) * 5);
      background: var(--bb-neutral-300);
      margin: 0px calc(var(--bb-grid-size) * 3);
    }

    bb-overflow-menu {
      position: absolute;
      top: calc(var(--bb-grid-size) * 11);
      right: auto;
      left: calc(var(--bb-grid-size) * 40);
    }

    #subgraph-selector {
      color: var(--bb-ui-500);
      border: none;
      font-size: var(--bb-label-large);
    }

    #add-sub-board,
    #delete-sub-board {
      background: none;
      width: 16px;
      height: 16px;
      background-position: center center;
      background-repeat: no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    #add-sub-board {
      background-image: var(--bb-icon-add-circle);
    }

    #delete-sub-board {
      background-image: var(--bb-icon-delete);
    }

    #add-sub-board:hover,
    #delete-sub-board:hover {
      opacity: 1;
    }

    #delete-sub-board[disabled] {
      opacity: 0.3;
      cursor: auto;
    }

    #readonly-overlay {
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-9);
      position: absolute;
      top: var(--bb-grid-size-3);
      left: 50%;
      transform: translateX(-50%);
      color: var(--bb-boards-900);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-boards-300);
      border-radius: var(--bb-grid-size-10);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
    }

    #readonly-overlay::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-icon-saved-readonly) center center / 20px 20px
        no-repeat;
      margin-right: var(--bb-grid-size);
      mix-blend-mode: difference;
    }

    #activity-marker {
      align-items: center;
      background: var(--bb-neutral-50);
      border-radius: var(--bb-grid-size-10);
      border: 1px solid var(--bb-neutral-300);
      bottom: calc(var(--bb-grid-size) * 3);
      color: var(--bb-neutral-900);
      cursor: pointer;
      display: flex;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      height: var(--bb-grid-size-9);
      justify-content: center;
      position: absolute;
      right: calc(var(--bb-grid-size) * 42);
      transition: all 0.3s cubic-bezier(0, 0, 0.3, 1);
      width: var(--bb-grid-size-9);
    }

    #activity-marker::after {
      content: "";
      width: 100%;
      height: 100%;
      pointer-events: none;
      opacity: 0.4;
      top: -8px;
      left: -8px;
      border-radius: 50%;
      position: absolute;
    }

    #activity-marker.pending {
      border: 1px solid var(--bb-inputs-700);
      background: var(--bb-inputs-500);
      color: var(--bb-neutral-0);
    }

    #activity-marker.pending::after {
      animation: expand 3s cubic-bezier(0, 0, 0.3, 1) forwards infinite;
    }

    #activity-marker.error {
      border: 1px solid var(--bb-warning-700);
      background: var(--bb-warning-600);
      color: var(--bb-neutral-0);
    }

    @keyframes expand {
      0% {
        opacity: 0;
        transform: scale(1);
        border: 8px solid var(--bb-inputs-500);
      }

      5% {
        opacity: 0.4;
      }

      50% {
        opacity: 0;
        transform: scale(1.5) translate(4px, 4px);
      }

      100% {
        opacity: 0;
        transform: scale(1.5) translate(4px, 4px);
        border: 0px solid var(--bb-inputs-500);
      }
    }

    #active-component {
      position: absolute;
      bottom: calc(var(--bb-grid-size) * 3);
      right: calc(var(--bb-grid-size) * 54);
      border-radius: 50px;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: none;
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
      display: flex;
      align-items: center;
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-10);
      height: var(--bb-grid-size-9);
      cursor: pointer;
      color: var(--bb-neutral-500);
      border: 1px solid var(--bb-neutral-300);
      transition: all 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #controls #active-component {
      margin-left: 0;
    }

    #active-component:hover {
      color: var(--bb-inputs-600);
      border: 1px solid var(--bb-inputs-300);
    }

    #active-component::before {
      content: "";
      width: 20px;
      height: 20px;
      padding-right: var(--bb-grid-size);
      background: var(--bb-icon-directions) left center / 20px 20px no-repeat;
    }

    #active-component.active {
      opacity: 1;
      color: var(--bb-inputs-700);
      background: var(--bb-inputs-50);
      border: 1px solid var(--bb-inputs-500);
    }

    #active-component:hover::before,
    #active-component.active::before {
      background: var(--bb-icon-directions-active) left center / 20px 20px
        no-repeat;
    }
  `;

  async #processGraph(): Promise<GraphRenderer> {
    if (GraphAssets.assetPrefix !== this.assetPrefix) {
      GraphAssets.instance().loadAssets(this.assetPrefix);
      await GraphAssets.instance().loaded;
    }

    await this.#graphRenderer.ready;

    if (!this.graph) {
      this.#graphRenderer.deleteGraphs();
      return this.#graphRenderer;
    }

    this.#graphVersion++;
    this.#graphRenderer.readOnly = this.readOnly;
    this.#graphRenderer.highlightInvalidWires = this.highlightInvalidWires;

    let selectedGraph = this.graph;
    if (this.subGraphId) {
      const subgraphs = selectedGraph.graphs();
      if (subgraphs[this.subGraphId]) {
        selectedGraph = subgraphs[this.subGraphId];
      } else {
        console.warn(`Unable to locate subgraph by name: ${this.subGraphId}`);
      }
    }

    // Force a reset when the board changes.
    if (this.boardId !== this.#lastBoardId) {
      this.#graphRenderer.removeAllGraphs();
      this.#lastBoardId = this.boardId;
    }

    const ports = new Map<string, InspectableNodePorts>();
    const typeMetadata = new Map<string, NodeHandlerMetadata>();
    const graphVersion = this.#graphVersion;

    for (const node of selectedGraph.nodes()) {
      ports.set(node.descriptor.id, await node.ports());
      try {
        typeMetadata.set(node.descriptor.type, await node.type().metadata());
      } catch (err) {
        // In the event of failing to get the type info, suggest removing the
        // node from the graph.
        this.dispatchEvent(
          new NodeTypeRetrievalErrorEvent(node.descriptor.id, this.subGraphId)
        );
      }

      if (this.#graphVersion !== graphVersion) {
        // Another update has come in, bail out.
        return this.#graphRenderer;
      }
    }

    if (!this.graph) {
      return this.#graphRenderer;
    }

    const url = this.graph.raw().url || "";
    this.#graphRenderer.hideAllGraphs();

    // Attempt to update the graph if it already exists.
    const updated = this.#graphRenderer.updateGraphByUrl(url, this.subGraphId, {
      showNodeTypeDescriptions: this.showNodeTypeDescriptions,
      showNodePreviewValues: this.showNodePreviewValues,
      collapseNodesByDefault: this.collapseNodesByDefault,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      metadata: selectedGraph.metadata(),
    });

    if (updated) {
      this.#graphRenderer.showGraph(url, this.subGraphId);
      if (this.topGraphResult) {
        this.#graphRenderer.topGraphResult = this.topGraphResult;
      }

      return this.#graphRenderer;
    }

    if (this.#lastSubGraphId !== this.subGraphId) {
      // TODO: Need to figure out how to encode the subgraph/node id combo.
      this.#graphRenderer.topGraphResult = null;
    }

    this.#graphRenderer.createGraph({
      url,
      subGraphId: this.subGraphId,
      showNodeTypeDescriptions: this.showNodeTypeDescriptions,
      showNodePreviewValues: this.showNodePreviewValues,
      collapseNodesByDefault: this.collapseNodesByDefault,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      metadata: selectedGraph.metadata() || {},
      visible: false,
    });

    this.#graphRenderer.addEventListener(
      GraphInitialDrawEvent.eventName,
      () => {
        this.#graphRenderer.showGraph(url, this.subGraphId);
        this.#graphRenderer.zoomToFit();

        // When we're loading a graph from existing results, we need to
        // set the topGraphResult again so that it is applied to the newly
        // created graph.
        if (this.topGraphResult) {
          this.#graphRenderer.topGraphResult = this.topGraphResult;
        }
      },
      { once: true }
    );

    return this.#graphRenderer;
  }

  constructor() {
    super();

    this.zoomToHighlightedNodeDuringRuns =
      (globalThis.localStorage.getItem(ZOOM_KEY) ?? "true") === "true";
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#graphRenderer.addEventListener(
      GraphEdgeAttachEvent.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.#graphRenderer.addEventListener(
      GraphEdgeDetachEvent.eventName,
      this.#onGraphEdgeDetachBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeEdgeChangeEvent.eventName,
      this.#onGraphEdgeChangeBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeDeleteEvent.eventName,
      this.#onGraphNodeDeleteBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodesVisualUpdateEvent.eventName,
      this.#onGraphNodesVisualUpdateBound
    );

    this.#graphRenderer.addEventListener(
      GraphEntityRemoveEvent.eventName,
      this.#onGraphEntityRemoveBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeEditEvent.eventName,
      this.#onGraphNodeEditBound
    );

    this.#graphRenderer.addEventListener(
      GraphEdgeValueSelectedEvent.eventName,
      this.#onGraphEdgeValueSelectedBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeActivitySelectedEvent.eventName,
      this.#onGraphNodeActivitySelectedBound
    );

    this.#graphRenderer.addEventListener(
      GraphInteractionEvent.eventName,
      this.#onGraphInteractionBound
    );

    this.#graphRenderer.addEventListener(
      GraphShowTooltipEvent.eventName,
      this.#onGraphShowTooltipBound
    );

    this.#graphRenderer.addEventListener(
      GraphHideTooltipEvent.eventName,
      this.#onGraphHideTooltipBound
    );

    this.#graphRenderer.addEventListener(
      GraphCommentEditRequestEvent.eventName,
      this.#onGraphCommentEditRequestBound
    );

    window.addEventListener("resize", this.#onResizeBound);
    this.addEventListener("keydown", this.#onKeyDownBound);
    this.addEventListener("pointermove", this.#onPointerMoveBound);
    this.addEventListener("pointerdown", this.#onPointerDownBound);
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#graphRenderer.removeEventListener(
      GraphEdgeAttachEvent.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.#graphRenderer.removeEventListener(
      GraphEdgeDetachEvent.eventName,
      this.#onGraphEdgeDetachBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeEdgeChangeEvent.eventName,
      this.#onGraphEdgeChangeBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeDeleteEvent.eventName,
      this.#onGraphNodeDeleteBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodesVisualUpdateEvent.eventName,
      this.#onGraphNodesVisualUpdateBound
    );

    this.#graphRenderer.removeEventListener(
      GraphEntityRemoveEvent.eventName,
      this.#onGraphEntityRemoveBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeEditEvent.eventName,
      this.#onGraphNodeEditBound
    );

    this.#graphRenderer.removeEventListener(
      GraphEdgeValueSelectedEvent.eventName,
      this.#onGraphEdgeValueSelectedBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeActivitySelectedEvent.eventName,
      this.#onGraphNodeActivitySelectedBound
    );

    this.#graphRenderer.removeEventListener(
      GraphInteractionEvent.eventName,
      this.#onGraphInteractionBound
    );

    this.#graphRenderer.removeEventListener(
      GraphShowTooltipEvent.eventName,
      this.#onGraphShowTooltipBound
    );

    this.#graphRenderer.removeEventListener(
      GraphHideTooltipEvent.eventName,
      this.#onGraphHideTooltipBound
    );

    this.#graphRenderer.removeEventListener(
      GraphCommentEditRequestEvent.eventName,
      this.#onGraphCommentEditRequestBound
    );

    window.removeEventListener("resize", this.#onResizeBound);
    this.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (!changedProperties.has("run")) {
      return;
    }

    this.#graphRenderer.zoomToHighlightedNode =
      this.zoomToHighlightedNodeDuringRuns;
  }

  #onGraphInteraction() {
    // Only switch off the flag if there is a run active.
    if (!this.topGraphResult?.currentNode) {
      return;
    }

    this.zoomToHighlightedNodeDuringRuns = false;
  }

  #onGraphShowTooltip(evt: Event) {
    const tooltipEvt = evt as GraphShowTooltipEvent;
    this.dispatchEvent(
      new ShowTooltipEvent(tooltipEvt.message, tooltipEvt.x, tooltipEvt.y)
    );
  }

  #onGraphHideTooltip() {
    this.dispatchEvent(new HideTooltipEvent());
  }

  #onGraphCommentEditRequest(evt: Event) {
    const commentEvt = evt as GraphCommentEditRequestEvent;
    this.dispatchEvent(
      new CommentEditRequestEvent(
        commentEvt.id,
        commentEvt.x,
        commentEvt.y,
        this.subGraphId
      )
    );
  }

  #onPointerMove(evt: PointerEvent) {
    this.#lastX = evt.pageX - this.#left + window.scrollX;
    this.#lastY = evt.pageY - this.#top - window.scrollY;
  }

  #isNodeDescriptor(item: unknown): item is NodeDescriptor {
    return (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "type" in item
    );
  }

  #isEdge(item: unknown): item is Edge {
    return (
      typeof item === "object" &&
      item !== null &&
      "from" in item &&
      "to" in item
    );
  }

  async #onKeyDown(evt: KeyboardEvent) {
    if (this.readOnly) {
      return;
    }

    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    if (isCtrlCommand && this.graph) {
      // Copy.
      if (evt.key === "c") {
        if (this.#writingToClipboard) {
          return;
        }

        const selected = this.#graphRenderer.getSelectedChildren();
        if (!selected.length) {
          return;
        }

        let breadboardGraph = this.graph.raw();
        if (this.subGraphId && breadboardGraph.graphs) {
          const subgraphs = breadboardGraph.graphs;
          if (subgraphs[this.subGraphId]) {
            breadboardGraph = subgraphs[this.subGraphId];
          } else {
            console.warn(
              `Unable to locate subgraph by name: ${this.subGraphId}`
            );
          }
        }

        const nodes = breadboardGraph.nodes.filter((node) => {
          return selected.find((item) => item.label === node.id);
        });

        const edges = breadboardGraph.edges.filter((edge) => {
          return selected.find((item) => {
            if (!(item instanceof GraphEdge)) {
              return false;
            }

            if (!item.edge) {
              return false;
            }

            return (
              item.edge.from.descriptor.id === edge.from &&
              item.edge.to.descriptor.id === edge.to
            );
          });
        });

        breadboardGraph.metadata ??= {};
        breadboardGraph.metadata.comments ??= [];
        const metadataComments = breadboardGraph.metadata.comments;
        const comments = metadataComments.filter((node) => {
          return selected.find((item) => item.label === node.id);
        });

        const metadata = { ...breadboardGraph.metadata, comments };

        this.#writingToClipboard = true;
        await navigator.clipboard.writeText(
          JSON.stringify(
            {
              title: breadboardGraph.title,
              description: breadboardGraph.description,
              version: breadboardGraph.version,
              metadata,
              edges,
              nodes,
            },
            null,
            2
          )
        );
        this.#writingToClipboard = false;
      } else if (evt.key === "v") {
        // Paste.
        if (this.#readingFromClipboard) {
          return;
        }

        this.#graphRenderer.deselectAllChildren();

        try {
          this.#readingFromClipboard = true;
          const data = await navigator.clipboard.readText();
          if (!data || !this.graph) {
            return;
          }

          let graph;
          // TODO: This is a kludge, let's be more robust here.
          // Maybe like InspectableGraph.isGraphURL(data) or something.
          if (data.endsWith(".bgl.json")) {
            graph = {
              edges: [],
              nodes: [
                {
                  id: this.#createRandomID(data),
                  type: data,
                },
              ],
            };
          } else {
            graph = JSON.parse(data) as GraphDescriptor;
            if (!("edges" in graph && "nodes" in graph)) {
              return;
            }
          }

          const comments = graph.metadata?.comments ?? [];
          const nodesAndComments = [...graph.nodes, ...comments];
          nodesAndComments.sort(
            (
              nodeA: NodeDescriptor | CommentNode,
              nodeB: NodeDescriptor | CommentNode
            ) => {
              if (nodeA.metadata?.visual && nodeB.metadata?.visual) {
                const visualA = nodeA.metadata.visual as Record<string, number>;
                const visualB = nodeB.metadata.visual as Record<string, number>;
                return visualA.x - visualB.x;
              }

              if (nodeA.metadata?.visual && !nodeB.metadata?.visual) {
                return -1;
              }

              if (!nodeA.metadata?.visual && nodeB.metadata?.visual) {
                return 1;
              }

              return 0;
            }
          );

          if (!nodesAndComments.length) {
            return;
          }

          const leftMostNode = nodesAndComments[0];
          let leftMostVisual = structuredClone(
            leftMostNode.metadata?.visual
          ) as Record<string, number>;
          if (!leftMostVisual) {
            leftMostVisual = { x: 0, y: 0 };
          }

          const leftMostNodeGlobalPosition = this.#graphRenderer.toGlobal({
            x: leftMostVisual.x,
            y: leftMostVisual.y,
          });

          // Find the current graph.
          let breadboardGraph = this.graph.raw();
          if (this.subGraphId && breadboardGraph.graphs) {
            const subgraphs = breadboardGraph.graphs;
            if (subgraphs[this.subGraphId]) {
              breadboardGraph = subgraphs[this.subGraphId];
            } else {
              console.warn(
                `Unable to locate subgraph by name: ${this.subGraphId}`
              );
            }
          }

          if (!breadboardGraph) {
            return;
          }

          const remappedNodeIds = new Map<string, string>();
          const edits: EditSpec[] = [];
          for (let i = 0; i < graph.nodes.length; i++) {
            const node = graph.nodes[i];
            if (!this.#isNodeDescriptor(node)) {
              continue;
            }

            // Update the node ID so it doesn't clash.
            const existingNode = breadboardGraph.nodes.find(
              (graphNode) => graphNode.id === node.id
            );
            if (existingNode) {
              node.id = this.#createRandomID(node.type);
              remappedNodeIds.set(existingNode.id, node.id);
            }

            node.metadata = node.metadata || {};
            node.metadata.visual = (node.metadata.visual || {}) as Record<
              string,
              NodeValue
            >;

            // Grab the x & y coordinates, delete them, and use them to instruct
            // the graph where to place the node when it's added.
            const x = (node.metadata.visual["x"] as number) ?? i * 40;
            const y = (node.metadata.visual["y"] as number) ?? 0;

            delete node.metadata.visual["x"];
            delete node.metadata.visual["y"];

            const globalPosition = this.#graphRenderer.toGlobal({ x, y });
            const offset = {
              x: globalPosition.x - leftMostNodeGlobalPosition.x,
              y: globalPosition.y - leftMostNodeGlobalPosition.y,
            };

            const position = {
              x: this.#lastX + offset.x - PASTE_OFFSET,
              y: this.#lastY + offset.y - PASTE_OFFSET,
            };

            this.#graphRenderer.setNodeLayoutPosition(
              node.id,
              "node",
              position,
              this.collapseNodesByDefault ? "collapsed" : "expanded",
              false
            );
            this.#graphRenderer.addToAutoSelect(node.id);

            // Ask the graph for the visual positioning because the graph accounts for
            // any transforms, whereas our base x & y values do not.
            const layout = this.#graphRenderer.getNodeLayoutPosition(
              node.id
            ) || {
              x: 0,
              y: 0,
            };
            node.metadata.visual.x = layout.x;
            node.metadata.visual.y = layout.y;

            edits.push({ type: "addnode", node });
          }

          for (const edge of graph.edges) {
            if (!this.#isEdge(edge)) {
              continue;
            }

            const newEdge = {
              from: remappedNodeIds.get(edge.from) ?? edge.from,
              to: remappedNodeIds.get(edge.to) ?? edge.to,
              in: edge.in ?? "MISSING_WIRE",
              out: edge.out ?? "MISSING_WIRE",
            };

            const existingEdge = breadboardGraph.edges.find(
              (graphEdge) =>
                graphEdge.from === newEdge.from &&
                graphEdge.to === newEdge.to &&
                graphEdge.out === newEdge.out &&
                graphEdge.in === newEdge.in
            );
            if (existingEdge) {
              continue;
            }

            if (edge.in === "MISSING_WIRE" || edge.out === "MISSING_WIRE") {
              continue;
            }

            this.#graphRenderer.addToAutoSelect(edgeToString(newEdge));
            edits.push({ type: "addedge", edge: newEdge });
          }

          if (graph.metadata && graph.metadata.comments) {
            breadboardGraph.metadata ??= {};
            breadboardGraph.metadata.comments ??= [];

            const newComments: CommentNode[] = [];
            for (const comment of graph.metadata.comments) {
              // Update the node ID so it doesn't clash.
              const existingNode = breadboardGraph.metadata.comments.find(
                (graphNode) => graphNode.id === comment.id
              );

              if (existingNode) {
                comment.id = this.#createRandomID("comment");
              }

              // Grab the x & y coordinates, delete them, and use them to instruct
              // the graph where to place the node when it's added.
              comment.metadata ??= {};
              comment.metadata.visual ??= {};

              const visual = comment.metadata.visual as Record<string, number>;
              const x = (visual["x"] as number) ?? 0;
              const y = (visual["y"] as number) ?? 0;

              delete visual["x"];
              delete visual["y"];

              const globalPosition = this.#graphRenderer.toGlobal({ x, y });
              const offset = {
                x: globalPosition.x - leftMostNodeGlobalPosition.x,
                y: globalPosition.y - leftMostNodeGlobalPosition.y,
              };

              const position = {
                x: this.#lastX + offset.x - PASTE_OFFSET,
                y: this.#lastY + offset.y - PASTE_OFFSET,
              };

              this.#graphRenderer.setNodeLayoutPosition(
                comment.id,
                "comment",
                position,
                this.collapseNodesByDefault ? "collapsed" : "expanded",
                false
              );
              this.#graphRenderer.addToAutoSelect(comment.id);

              // Ask the graph for the visual positioning because the graph accounts for
              // any transforms, whereas our base x & y values do not.
              const layout = this.#graphRenderer.getNodeLayoutPosition(
                comment.id
              ) || {
                x: 0,
                y: 0,
              };

              visual.x = layout.x;
              visual.y = layout.y;

              newComments.push(comment);
            }

            breadboardGraph.metadata.comments = [
              ...breadboardGraph.metadata.comments,
              ...newComments,
            ];
            edits.push({
              type: "changegraphmetadata",
              metadata: breadboardGraph.metadata,
            });
          }

          this.dispatchEvent(
            new MultiEditEvent(
              edits,
              `Paste (#${++this.#pasteCount})`,
              this.subGraphId
            )
          );
        } catch (err) {
          // Not JSON data - ignore.
          return;
        } finally {
          this.#readingFromClipboard = false;
        }
      }
    }
  }

  #onPointerDown(evt: Event) {
    if (!this.#addButtonRef.value) {
      return;
    }

    const [top] = evt.composedPath();
    if (
      top instanceof HTMLLabelElement &&
      top.getAttribute("for") === "add-node"
    ) {
      return;
    }

    this.#addButtonRef.value.checked = false;
  }

  #onGraphNodesVisualUpdate(evt: Event) {
    const moveEvt = evt as GraphNodesVisualUpdateEvent;
    const label = moveEvt.nodes.reduce((prev, curr, idx) => {
      return (
        prev +
        (idx > 0 ? ", " : "") +
        `(${curr.id}, {x: ${curr.x}, y: ${curr.y}, collapsed: ${curr.expansionState}})`
      );
    }, "");
    const editsEvt = new MultiEditEvent(
      moveEvt.nodes.map((node) => {
        switch (node.type) {
          case "node": {
            const graphNode = this.graph?.nodeById(node.id);
            const metadata = (graphNode?.metadata() || {}) as Record<
              string,
              unknown
            >;

            return {
              type: "changemetadata",
              id: node.id,
              metadata: {
                ...metadata,
                visual: {
                  x: node.x,
                  y: node.y,
                  collapsed: node.expansionState,
                },
              },
            };
          }

          case "comment": {
            if (!this.graph) {
              throw new Error("No active graph - unable to update");
            }

            const metadata = this.graph.metadata() || {};
            const commentNode = metadata.comments?.find(
              (commentNode) => commentNode.id === node.id
            );

            if (commentNode && commentNode.metadata) {
              commentNode.metadata.visual = {
                x: node.x,
                y: node.y,
                collapsed: node.expansionState,
              };
            }

            return {
              type: "changegraphmetadata",
              metadata,
            };
          }
        }
      }),
      `Node multimove: ${label}`,
      this.subGraphId
    );

    if (this.readOnly) {
      return;
    }

    this.dispatchEvent(editsEvt);
  }

  #onGraphEdgeAttach(evt: Event) {
    const { edge } = evt as GraphEdgeAttachEvent;
    this.dispatchEvent(
      new EdgeChangeEvent(
        "add",
        {
          from: edge.from.descriptor.id,
          to: edge.to.descriptor.id,
          out: edge.out,
          in: edge.in,
          constant: edge.type === "constant",
        },
        undefined,
        this.subGraphId
      )
    );
  }

  #onGraphEdgeDetach(evt: Event) {
    const { edge } = evt as GraphEdgeDetachEvent;
    this.dispatchEvent(
      new EdgeChangeEvent(
        "remove",
        {
          from: edge.from.descriptor.id,
          to: edge.to.descriptor.id,
          out: edge.out,
          in: edge.in,
        },
        undefined,
        this.subGraphId
      )
    );
  }

  #onGraphEdgeChange(evt: Event) {
    const { fromEdge, toEdge } = evt as GraphNodeEdgeChangeEvent;
    this.dispatchEvent(
      new EdgeChangeEvent(
        "move",
        {
          from: fromEdge.from.descriptor.id,
          to: fromEdge.to.descriptor.id,
          out: fromEdge.out,
          in: fromEdge.in,
          constant: fromEdge.type === "constant",
        },
        {
          from: toEdge.from.descriptor.id,
          to: toEdge.to.descriptor.id,
          out: toEdge.out,
          in: toEdge.in,
          constant: toEdge.type === "constant",
        },
        this.subGraphId
      )
    );
  }

  #onGraphNodeDelete(evt: Event) {
    const { id } = evt as GraphNodeDeleteEvent;
    this.dispatchEvent(new NodeDeleteEvent(id, this.subGraphId));
  }

  #onGraphEntityRemove(evt: Event) {
    const { nodes, edges, comments } = evt as GraphEntityRemoveEvent;
    const edits: EditSpec[] = [];

    // Remove edges first.
    for (const edge of edges) {
      edits.push({
        type: "removeedge",
        edge: {
          from: edge.from.descriptor.id,
          to: edge.to.descriptor.id,
          out: edge.out,
          in: edge.in,
        },
      });
    }

    // Remove nodes.
    for (const id of nodes) {
      edits.push({ type: "removenode", id });
    }

    // Remove comments.
    let graph = this.graph?.raw();
    if (this.subGraphId && graph?.graphs) {
      graph = graph.graphs[this.subGraphId];
    }
    if (graph && graph.metadata) {
      graph.metadata.comments ??= [];
      graph.metadata.comments = graph.metadata.comments.filter(
        (comment) => !comments.includes(comment.id)
      );
      edits.push({
        type: "changegraphmetadata",
        metadata: graph.metadata,
      });
    }

    // Create some comments for bookkeeping.
    const nodesLabel = nodes.length ? `#${nodes.join(", #")}` : "No nodes";
    const edgesLabel = edges.length
      ? edges.reduce((prev, curr, idx) => {
          return (
            prev +
            (idx > 0 ? ", " : "") +
            edgeToString({
              from: curr.from.descriptor.id,
              to: curr.to.descriptor.id,
              out: curr.out,
              in: curr.in,
            })
          );
        }, "")
      : "No edges";
    const commentsLabel = comments.length
      ? `#${comments.join(", #")}`
      : "No comments";

    this.dispatchEvent(
      new MultiEditEvent(
        edits,
        `Delete (${nodesLabel}) (${edgesLabel}) (${commentsLabel})`,
        this.subGraphId
      )
    );
  }

  #onGraphNodeEdit(evt: Event) {
    const { id, port, x, y, addHorizontalClickClearance } =
      evt as GraphNodeEditEvent;

    this.dispatchEvent(
      new NodeConfigurationUpdateRequestEvent(
        id,
        this.subGraphId,
        port,
        x,
        y,
        addHorizontalClickClearance
      )
    );
  }

  #onGraphEdgeValueSelected(evt: Event) {
    const { value, schema, x, y } = evt as GraphEdgeValueSelectedEvent;
    this.dispatchEvent(new EdgeValueSelectedEvent(value, schema, x, y));
  }

  #onGraphNodeActivitySelected(evt: Event) {
    const { nodeTitle, runId } = evt as GraphNodeActivitySelectedEvent;
    this.dispatchEvent(new NodeActivitySelectedEvent(nodeTitle, runId));
  }

  #onDragOver(evt: DragEvent) {
    evt.preventDefault();
  }

  #onDrop(evt: DragEvent) {
    const [top] = evt.composedPath();
    if (!(top instanceof HTMLCanvasElement)) {
      return;
    }

    evt.preventDefault();
    const type = evt.dataTransfer?.getData(DATA_TYPE);
    if (!type || !this.#graphRenderer) {
      return;
    }

    const id = this.#createRandomID(type);
    const x = evt.pageX - this.#left + window.scrollX;
    const y = evt.pageY - this.#top - window.scrollY;

    this.#graphRenderer.deselectAllChildren();

    // Store the middle of the node for later.
    this.#graphRenderer.setNodeLayoutPosition(
      id,
      type === "comment" ? "comment" : "node",
      { x, y },
      this.collapseNodesByDefault ? "collapsed" : "expanded",
      true
    );

    // Ask the graph for the visual positioning because the graph accounts for
    // any transforms, whereas our base x & y values do not.
    const layout = this.#graphRenderer.getNodeLayoutPosition(id) || {
      x: 0,
      y: 0,
    };

    const configuration = getDefaultConfiguration(type);
    this.dispatchEvent(
      new NodeCreateEvent(id, type, this.subGraphId, configuration, {
        visual: {
          x: layout.x,
          y: layout.y,
          collapsed: this.collapseNodesByDefault,
        },
      })
    );
  }

  #createRandomID(type: string) {
    const randomId = globalThis.crypto.randomUUID();
    const nextNodeId = randomId.split("-");
    // Now that types could be URLs, we need to make them a bit
    // less verbose.
    if (type.includes(":") || type.includes("#")) {
      // probably a URL, so let's create a nice short name from the URL
      try {
        const url = new URL(type);
        const name = url.pathname
          .split("/")
          .pop()
          ?.replace(".bgl.json", "")
          .slice(0, 15);
        if (name) {
          return `${name}-${nextNodeId[0]}`;
        }
      } catch (e) {
        // Ignore.
      }
      return `board-${nextNodeId[0]}`;
    }
    // TODO: Check for clashes
    return `${type}-${nextNodeId[0]}`;
  }

  #onResize() {
    const bounds = this.getBoundingClientRect();
    this.#top = bounds.top;
    this.#left = bounds.left;
  }

  #proposeNewSubGraph() {
    const newSubGraphName = prompt(
      "What would you like to call this sub board?"
    );
    if (!newSubGraphName) {
      return;
    }

    this.dispatchEvent(new SubGraphCreateEvent(newSubGraphName));
  }

  #dispatchActivityMarkerEvent(forceOn = false) {
    if (!this.#activityMarkerRef.value) {
      return;
    }

    const bounds = this.#activityMarkerRef.value.getBoundingClientRect();
    this.dispatchEvent(
      new ToggleBoardActivityEvent(
        bounds.left + bounds.width / 2,
        bounds.top - 10,
        forceOn
      )
    );
  }

  firstUpdated(): void {
    this.#onResizeBound();
  }

  render() {
    this.#graphRenderer.topGraphResult = this.subGraphId
      ? null
      : this.topGraphResult;

    if (this.#graphRenderer) {
      this.#graphRenderer.invertZoomScrollDirection =
        this.invertZoomScrollDirection;
    }

    const rawGraph = this.graph?.raw();
    const subGraphs: SubGraphs | null = rawGraph?.graphs
      ? rawGraph.graphs
      : null;

    let showSubGraphSelector = true;
    if (
      this.hideSubboardSelectorWhenEmpty &&
      (!subGraphs || (subGraphs && Object.entries(subGraphs).length === 0))
    ) {
      showSubGraphSelector = false;
    }

    const isRunning = this.topGraphResult
      ? this.topGraphResult.status === "running" ||
        this.topGraphResult.status === "paused"
      : false;

    let saveButton: HTMLTemplateResult | symbol = nothing;
    try {
      if (this.capabilities && this.capabilities.save) {
        saveButton = html`<button
          id="save-board"
          @click=${() => {
            this.dispatchEvent(new SaveEvent());
          }}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent("Save board", evt.clientX, evt.clientY)
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
        >
          Save
        </button>`;
      } else {
        saveButton = html`<button
          id="save-board"
          @click=${() => {
            this.dispatchEvent(new SaveAsEvent());
          }}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent("Save board as...", evt.clientX, evt.clientY)
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
        >
          Save As...
        </button>`;
      }
    } catch (err) {
      // If there are any problems with the URL, etc, don't offer the save button.
    }

    let overflowMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showOverflowMenu) {
      const actions: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
      }> = [
        {
          title: "Edit Board Details",
          name: "edit-board-details",
          icon: "edit",
        },
        {
          title: "Copy Board Contents",
          name: "copy-board-contents",
          icon: "copy",
        },
        {
          title: "Copy Board URL",
          name: "copy-to-clipboard",
          icon: "copy",
        },
        {
          title: "Copy Tab URL",
          name: "copy-tab-to-clipboard",
          icon: "copy",
        },
        {
          title: "Download Board",
          name: "download",
          icon: "download",
        },
      ];

      if (this.capabilities) {
        if (this.capabilities.delete) {
          actions.push({
            title: "Delete Board",
            name: "delete",
            icon: "delete",
          });
        }

        if (this.capabilities.save) {
          actions.push({
            title: "Save As...",
            name: "save-as",
            icon: "save",
          });
        }
      }

      if (this.extendedCapabilities && this.extendedCapabilities.preview) {
        actions.push({
          title: "Copy Preview URL",
          name: "preview",
          icon: "preview",
        });
      }

      overflowMenu = html`<bb-overflow-menu
        .actions=${actions}
        .disabled=${this.graph === null}
        @bboverflowmenudismissed=${() => {
          this.showOverflowMenu = false;
        }}
        @bboverflowmenuaction=${() => {
          this.showOverflowMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    let isInputPending = false;
    let isError = false;
    const newestEvent = this.run?.events.at(-1);
    if (newestEvent) {
      isInputPending =
        newestEvent.type === "node" &&
        newestEvent.node.descriptor.type === "input";
      isError = newestEvent.type === "error";
    }

    return html`${until(this.#processGraph())}
      ${
        this.showControls && this.graph !== null
          ? html` <button
                id="debug"
                title="Debug this board"
                ?disabled=${!this.graph || this.readOnly}
                @click=${() => {
                  if (isRunning) {
                    this.dispatchEvent(new StopEvent());
                  } else {
                    this.#dispatchActivityMarkerEvent(true);
                    this.dispatchEvent(new RunEvent());
                  }
                }}
              >
                ${isRunning ? "Stop Board" : "Debug Board"}
              </button>

              <button
                title="Zoom to highlighted component during runs"
                id="active-component"
                class=${classMap({
                  active: this.zoomToHighlightedNodeDuringRuns,
                  visible: isRunning,
                })}
                @click=${() => {
                  const shouldZoom = !this.zoomToHighlightedNodeDuringRuns;
                  this.zoomToHighlightedNodeDuringRuns = shouldZoom;
                  this.#graphRenderer.zoomToHighlightedNode = shouldZoom;
                  globalThis.localStorage.setItem(
                    ZOOM_KEY,
                    shouldZoom.toString()
                  );

                  if (!shouldZoom) {
                    return;
                  }

                  if (this.topGraphResult?.currentNode) {
                    this.#graphRenderer.zoomToNode(
                      this.topGraphResult.currentNode.descriptor.id,
                      -0.1
                    );
                  }
                }}
              >
                Follow
              </button>

              <button
                id="activity-marker"
                ${ref(this.#activityMarkerRef)}
                class=${classMap({
                  pending: isInputPending,
                  error: isError,
                  visible: isRunning,
                })}
                @click=${() => {
                  this.#dispatchActivityMarkerEvent();
                }}
                @pointerover=${(evt: PointerEvent) => {
                  this.dispatchEvent(
                    new ShowTooltipEvent(
                      "See board activity",
                      evt.clientX,
                      evt.clientY
                    )
                  );
                }}
                @pointerout=${() => {
                  this.dispatchEvent(new HideTooltipEvent());
                }}
              >
                ${this.run ? this.run.events.length : 0}
              </button>

              ${this.readOnly
                ? nothing
                : html`
                    <div id="controls">
                      <button
                        id="zoom-to-fit"
                        @click=${() => this.#graphRenderer.zoomToFit()}
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Zoom board to fit",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                      >
                        Zoom to fit
                      </button>
                      <button
                        id="reset-layout"
                        @click=${() => {
                          this.#graphRenderer.resetGraphLayout();
                        }}
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Reset board layout",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                      >
                        Reset Layout
                      </button>

                      ${showSubGraphSelector
                        ? html`<div class="divider"></div>
                            <select
                              id="subgraph-selector"
                              @input=${(evt: Event) => {
                                if (
                                  !(evt.target instanceof HTMLSelectElement)
                                ) {
                                  return;
                                }

                                this.dispatchEvent(
                                  new SubGraphChosenEvent(evt.target.value)
                                );
                              }}
                              @pointerover=${(evt: PointerEvent) => {
                                this.dispatchEvent(
                                  new ShowTooltipEvent(
                                    "Change board",
                                    evt.clientX,
                                    evt.clientY
                                  )
                                );
                              }}
                              @pointerout=${() => {
                                this.dispatchEvent(new HideTooltipEvent());
                              }}
                            >
                              <option
                                ?selected=${this.subGraphId === null}
                                value="${MAIN_BOARD_ID}"
                              >
                                Main board
                              </option>
                              ${map(
                                Object.entries(subGraphs || []),
                                ([subGraphId, subGraph]) => {
                                  return html`<option
                                    value="${subGraphId}"
                                    ?selected=${subGraphId === this.subGraphId}
                                  >
                                    ${subGraph.title || subGraphId}
                                  </option>`;
                                }
                              )}
                            </select>`
                        : nothing}
                      <button
                        id="add-sub-board"
                        @click=${() => this.#proposeNewSubGraph()}
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Add Sub board",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                      >
                        Add sub board
                      </button>
                      <button
                        id="delete-sub-board"
                        ?disabled=${this.subGraphId === null}
                        @click=${() => {
                          if (!this.subGraphId) {
                            return;
                          }

                          if (
                            !confirm(
                              "Are you sure you wish to delete this sub board?"
                            )
                          ) {
                            return;
                          }

                          this.dispatchEvent(
                            new SubGraphDeleteEvent(this.subGraphId)
                          );
                        }}
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Delete sub board",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                      >
                        Delete sub board
                      </button>
                      <div class="divider"></div>

                      <button
                        id="undo"
                        ?disabled=${!this.canUndo}
                        @click=${() => {
                          this.dispatchEvent(new UndoEvent());
                        }}
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              `Undo last action${this.canUndo ? "" : " (unavailable)"}`,
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                      >
                        Undo
                      </button>
                      <button
                        id="redo"
                        ?disabled=${!this.canRedo}
                        @click=${() => {
                          this.dispatchEvent(new RedoEvent());
                        }}
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              `Redo last action${this.canRedo ? "" : " (unavailable)"}`,
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                      >
                        Redo
                      </button>
                      ${saveButton}
                      <button
                        id="overflow"
                        @click=${() => {
                          this.showOverflowMenu = true;
                        }}
                      >
                        More...
                      </button>
                    </div>
                    ${overflowMenu}
                  `}
              ${this.graph !== null
                ? html`
                    <div id="nodes">
                      <button
                        draggable="true"
                        id="shortcut-add-specialist"
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Add Specialist Component",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                        @dblclick=${() => {
                          const id = this.#createRandomID("specialist");
                          this.#graphRenderer.deselectAllChildren();
                          this.dispatchEvent(
                            new NodeCreateEvent(id, "specialist")
                          );
                        }}
                        @dragstart=${(evt: DragEvent) => {
                          if (!evt.dataTransfer) {
                            return;
                          }
                          evt.dataTransfer.setData(DATA_TYPE, "specialist");
                        }}
                      >
                        Add Specialist
                      </button>
                      <button
                        draggable="true"
                        id="shortcut-add-human"
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Add Human Component",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                        @dblclick=${() => {
                          const id = this.#createRandomID("human");
                          this.#graphRenderer.deselectAllChildren();
                          this.dispatchEvent(new NodeCreateEvent(id, "human"));
                        }}
                        @dragstart=${(evt: DragEvent) => {
                          if (!evt.dataTransfer) {
                            return;
                          }
                          evt.dataTransfer.setData(DATA_TYPE, "human");
                        }}
                      >
                        Add Human
                      </button>
                      <button
                        draggable="true"
                        id="shortcut-add-looper"
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Add Looper Component",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                        @dblclick=${() => {
                          const id = this.#createRandomID("looper");
                          this.#graphRenderer.deselectAllChildren();
                          this.dispatchEvent(new NodeCreateEvent(id, "looper"));
                        }}
                        @dragstart=${(evt: DragEvent) => {
                          if (!evt.dataTransfer) {
                            return;
                          }
                          evt.dataTransfer.setData(DATA_TYPE, "looper");
                        }}
                      >
                        Add Human
                      </button>
                      <button
                        draggable="true"
                        id="shortcut-add-comment"
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new ShowTooltipEvent(
                              "Add Comment Component",
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(new HideTooltipEvent());
                        }}
                        @dblclick=${() => {
                          const id = this.#createRandomID("comment");
                          this.#graphRenderer.deselectAllChildren();
                          this.dispatchEvent(
                            new NodeCreateEvent(id, "comment")
                          );
                        }}
                        @dragstart=${(evt: DragEvent) => {
                          if (!evt.dataTransfer) {
                            return;
                          }
                          evt.dataTransfer.setData(DATA_TYPE, "comment");
                        }}
                      >
                        Add Human
                      </button>
                      <input
                        ${ref(this.#addButtonRef)}
                        name="add-node"
                        id="add-node"
                        type="checkbox"
                        @input=${(evt: InputEvent) => {
                          if (!(evt.target instanceof HTMLInputElement)) {
                            return;
                          }

                          if (!this.#nodeSelectorRef.value) {
                            return;
                          }

                          const nodeSelector = this.#nodeSelectorRef.value;
                          nodeSelector.inert = !evt.target.checked;

                          if (!evt.target.checked) {
                            return;
                          }
                          nodeSelector.selectSearchInput();
                        }}
                      />
                      <label for="add-node">Components</label>

                      <bb-node-selector
                        ${ref(this.#nodeSelectorRef)}
                        inert
                        .graph=${this.graph}
                        .showExperimentalComponents=${this
                          .showExperimentalComponents}
                        @bbkitnodechosen=${(evt: KitNodeChosenEvent) => {
                          const id = this.#createRandomID(evt.nodeType);
                          this.dispatchEvent(
                            new NodeCreateEvent(id, evt.nodeType)
                          );
                        }}
                      ></bb-node-selector>
                    </div>

                    ${this.readOnly
                      ? html`<section id="readonly-overlay">Read-only View</div>`
                      : nothing}
                  `
                : nothing}`
          : nothing
      }
      </div>`;
  }
}
