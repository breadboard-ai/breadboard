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
  InspectableGraph,
  InspectableNodePorts,
  InspectableRun,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlerMetadata,
  NodeValue,
  SubGraphs,
} from "@google-labs/breadboard";
import { LitElement, PropertyValues, css, html, nothing } from "lit";
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
  ShowTooltipEvent,
  SubGraphChosenEvent,
  SubGraphCreateEvent,
  SubGraphDeleteEvent,
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
        content: {
          type: "object",
          title: "Content",
          examples: [],
          behavior: ["llm-content"],
          default:
            type === "input" ? '{"role":"user","parts":[{"text":""}]}' : "null",
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
      bottom: 52px;
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
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 3);
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
      font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: var(--bb-grid-size);
    }

    label[for="add-node"]::before {
      content: "";
      width: 16px;
      height: 16px;
      background: var(--bb-icon-add) center center / 16px 16px no-repeat;
      margin-right: calc(var(--bb-grid-size) * 2);
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
      height: calc(var(--bb-grid-size) * 9);
      position: absolute;
      left: calc(var(--bb-grid-size) * 3);
      top: calc(var(--bb-grid-size) * 3);
      background: #fff;
      border-radius: 40px;
      padding: var(--bb-grid-size-2) var(--bb-grid-size) var(--bb-grid-size-2)
        var(--bb-grid-size-3);
      border: 1px solid var(--bb-neutral-300);
      display: flex;
      align-items: center;
    }

    #controls button {
      margin-left: calc(var(--bb-grid-size) * 2);
    }

    #controls button:first-of-type {
      margin-left: 0;
    }

    #reset-layout,
    #zoom-to-fit {
      width: 20px;
      height: 20px;
      cursor: pointer;
      background: center center no-repeat;
      background-size: 20px 20px;
      font-size: 0;
      cursor: pointer;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      opacity: 0.5;
      border: none;
    }

    #reset-layout {
      background-image: var(--bb-icon-reset-nodes);
    }

    #zoom-to-fit {
      background-image: var(--bb-icon-fit);
    }

    #reset-layout:hover,
    #zoom-to-fit:hover {
      transition-duration: 0.1s;
      opacity: 1;
    }

    .divider {
      width: 1px;
      height: calc(var(--bb-grid-size) * 5);
      background: var(--bb-neutral-300);
      margin: 0px calc(var(--bb-grid-size) * 3);
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

    #active-component {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      border: none;
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size);
      display: flex;
      align-items: center;
      background: var(--bb-ui-50);
      border-radius: var(--bb-grid-size-10);
      height: 24px;
      cursor: pointer;
    }

    #controls #active-component {
      margin-left: 0;
    }

    #active-component:hover,
    #active-component:focus {
      background: var(--bb-ui-100);
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
      background: var(--bb-ui-600);
      color: var(--bb-neutral-0);
    }

    #active-component.active::before {
      background: var(--bb-icon-directions-inverted) left center / 20px 20px
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

  #ignoreNextUpdate = false;
  protected shouldUpdate(): boolean {
    if (this.#ignoreNextUpdate) {
      this.#ignoreNextUpdate = false;
      return false;
    }

    return true;
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

    this.#ignoreNextUpdate = true;
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

    return html`${until(this.#processGraph())}
      ${
        this.showControls && this.graph !== null
          ? html` ${this.readOnly
              ? nothing
              : html`
                  <div id="controls">
                    <button
                      title="Zoom to fit"
                      id="zoom-to-fit"
                      @click=${() => this.#graphRenderer.zoomToFit()}
                    >
                      Zoom to fit
                    </button>
                    <button
                      title="Reset Layout"
                      id="reset-layout"
                      @click=${() => {
                        this.#graphRenderer.resetGraphLayout();
                      }}
                    >
                      Reset Layout
                    </button>

                    ${showSubGraphSelector
                      ? html`<div class="divider"></div>
                          <select
                            id="subgraph-selector"
                            @input=${(evt: Event) => {
                              if (!(evt.target instanceof HTMLSelectElement)) {
                                return;
                              }

                              this.dispatchEvent(
                                new SubGraphChosenEvent(evt.target.value)
                              );
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
                      title="Add new sub board"
                      @click=${() => this.#proposeNewSubGraph()}
                    >
                      Add sub board
                    </button>
                    <button
                      id="delete-sub-board"
                      title="Delete this sub board"
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
                    >
                      Delete sub board
                    </button>
                    <div class="divider"></div>
                    <button
                      title="Zoom to highlighted component during runs"
                      id="active-component"
                      class=${classMap({
                        active: this.zoomToHighlightedNodeDuringRuns,
                      })}
                      @click=${() => {
                        const shouldZoom =
                          !this.zoomToHighlightedNodeDuringRuns;
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
                            this.topGraphResult.currentNode.descriptor.id
                          );
                        }
                      }}
                    >
                      Follow run
                    </button>
                  </div>
                `}
            ${this.graph !== null
              ? html`
                  <div id="nodes">
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

                    ${this.showNodeShortcuts
                      ? html`<div class="divider"></div>
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
                              this.dispatchEvent(
                                new NodeCreateEvent(id, "human")
                              );
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
                              this.dispatchEvent(
                                new NodeCreateEvent(id, "looper")
                              );
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
                          </button>`
                      : nothing}
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
