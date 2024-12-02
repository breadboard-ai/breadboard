/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableGraph,
  InspectableNodePorts,
  InspectableRun,
  Kit,
  NodeConfiguration,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { LitElement, PropertyValues, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import {
  CommandsAvailableEvent,
  CommentEditRequestEvent,
  EdgeChangeEvent,
  EdgeValueSelectedEvent,
  EditorPointerPositionChangeEvent,
  GraphCommentEditRequestEvent,
  GraphEdgeAttachEvent,
  GraphEdgeDetachEvent,
  GraphEdgeValueSelectedEvent,
  GraphHideTooltipEvent,
  GraphInitialDrawEvent,
  GraphInteractionEvent,
  GraphNodeActivitySelectedEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEditEvent,
  GraphNodeRunRequestEvent,
  GraphShowTooltipEvent,
  HideTooltipEvent,
  InteractionEvent,
  NodeActivitySelectedEvent,
  NodeConfigurationUpdateRequestEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeRunRequestEvent,
  NodeTypeRetrievalErrorEvent,
  ShowTooltipEvent,
  WorkspaceSelectionStateEvent,
  WorkspaceVisualUpdateEvent,
} from "../../events/events.js";
import { GraphRenderer } from "./graph-renderer.js";
import { createRandomID } from "./utils.js";
import {
  Command,
  TopGraphRunResult,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types.js";
import { GraphAssets } from "./graph-assets.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  MAIN_BOARD_ID,
} from "../../constants/constants.js";
import { GraphOpts } from "./types.js";

const ZOOM_KEY = "bb-editor-zoom-to-highlighted-node-during-runs";
const DATA_TYPE = "text/plain";
const RIBBON_HEIGHT = 44;

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
          },
          default:
            type === "input"
              ? '[{"role":"user","parts":[{"text":""}]}]'
              : "null",
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
  kits: Kit[] = [];

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
  showReadOnlyLabel = true;

  @property()
  readOnly = false;

  @property()
  showReadOnlyOverlay = false;

  @property()
  highlightInvalidWires = false;

  @property()
  showExperimentalComponents = false;

  @property()
  showSubgraphsInline = true;

  @property()
  tabURLs: string[] = [];

  @property()
  showBoardHierarchy = true;

  @property()
  selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  visualChangeId: WorkspaceVisualChangeId | null = null;

  @property()
  set showPortTooltips(value: boolean) {
    this.#graphRenderer.showPortTooltips = value;
  }

  get showPortTooltips() {
    return this.#graphRenderer.showPortTooltips;
  }

  @property()
  set zoomToHighlightedNode(value: boolean) {
    this.#graphRenderer.zoomToHighlightedNode = value;
  }

  get zoomToHighlightedNode() {
    return this.#graphRenderer.zoomToHighlightedNode;
  }

  @property()
  isShowingBoardActivityOverlay = false;

  @state()
  showOverflowMenu = false;

  #graphRenderer = new GraphRenderer();
  // Incremented each time a graph is updated, used to avoid extra work
  // inspecting ports when the graph is updated.
  #graphVersion = 0;

  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onWorkspaceSelectionStateChangeBound =
    this.#onWorkspaceSelectionStateChange.bind(this);
  #onWorkspaceVisualUpdateChangeBound =
    this.#onWorkspaceVisualUpdateChange.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
  #onGraphNodeEditBound = this.#onGraphNodeEdit.bind(this);
  #onGraphEdgeValueSelectedBound = this.#onGraphEdgeValueSelected.bind(this);
  #onGraphNodeActivitySelectedBound =
    this.#onGraphNodeActivitySelected.bind(this);
  #onGraphInteractionBound = this.#onGraphInteraction.bind(this);
  #onGraphShowTooltipBound = this.#onGraphShowTooltip.bind(this);
  #onGraphHideTooltipBound = this.#onGraphHideTooltip.bind(this);
  #onGraphCommentEditRequestBound = this.#onGraphCommentEditRequest.bind(this);
  #onGraphNodeRunRequestBound = this.#onGraphNodeRunRequest.bind(this);

  #lastVisualChangeId: WorkspaceVisualChangeId | null = null;
  #lastSelectionChangeId: WorkspaceSelectionChangeId | null = null;

  #top = 0;
  #left = 0;
  #resizeObserver = new ResizeObserver(() => {
    const bounds = this.getBoundingClientRect();
    this.#top = bounds.top;
    this.#left = bounds.left;
  });

  #addButtonRef: Ref<HTMLInputElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background-color: var(--bb-ui-50);
      overflow: auto;
      position: relative;
      user-select: none;
      pointer-events: auto;
      width: 100%;
      height: 100%;
      position: relative;
      padding-top: 44px;
    }

    #readonly-overlay {
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-9);
      position: absolute;
      top: 52px;
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

    bb-graph-ribbon-menu {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 44px;
      flex: 0 0 auto;
      z-index: 1;
    }

    #content {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
      position: relative;
    }

    bb-graph-renderer {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
    }
  `;

  async #inspectableGraphToConfig(
    url: string,
    subGraphId: string | null,
    selectedGraph: InspectableGraph
  ): Promise<GraphOpts> {
    const ports = new Map<string, InspectableNodePorts>();
    const typeMetadata = new Map<string, NodeHandlerMetadata>();
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
    }

    const graphSelectionState = this.selectionState?.selectionState.graphs.get(
      subGraphId ? subGraphId : MAIN_BOARD_ID
    );

    return {
      url,
      title: selectedGraph.raw().title ?? "Untitled Board",
      subGraphId,
      visible: false,
      showNodeTypeDescriptions: this.showNodeTypeDescriptions,
      showNodePreviewValues: this.showNodePreviewValues,
      collapseNodesByDefault: this.collapseNodesByDefault,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      modules: selectedGraph.modules(),
      metadata: selectedGraph.metadata() || {},
      selectionState: graphSelectionState ?? null,
    };
  }

  async #processGraph() {
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
    this.#graphRenderer.showSubgraphsInline = this.showSubgraphsInline;

    const availableSubGraphs = Object.keys(this.graph.graphs() || {});
    this.#graphRenderer.deleteStaleSubGraphs(new Set(availableSubGraphs));
    this.#graphRenderer.hideAllGraphs();

    let shouldAnimate = true;

    const handleGraph = async (
      url: string,
      subGraphId: GraphIdentifier | null,
      selectedGraph: InspectableGraph
    ) => {
      const opts = await this.#inspectableGraphToConfig(
        url,
        subGraphId,
        selectedGraph
      );

      const updated = this.#graphRenderer.updateGraphByUrl(
        url,
        subGraphId,
        opts
      );
      if (!updated) {
        shouldAnimate = false;
        return new Promise<void>((resolve) => {
          this.#graphRenderer.createGraph(opts);
          this.#graphRenderer.addEventListener(
            GraphInitialDrawEvent.eventName,
            () => {
              this.#graphRenderer.showGraph(url, subGraphId);
              resolve();
            },
            { once: true }
          );
        });
      } else {
        this.#graphRenderer.showGraph(url, subGraphId);
      }
    };

    const url = this.graph.raw().url ?? "no-url";
    if (this.showSubgraphsInline) {
      await handleGraph(url, null, this.graph);

      const subGraphs = Object.entries(this.graph.graphs() ?? {});
      for (const [id, graph] of subGraphs) {
        await handleGraph(url, id, graph);
      }
    } else {
      if (!this.selectionState) {
        return this.#graphRenderer;
      }

      const state = this.selectionState.selectionState.graphs;
      const graphs = [...state.keys()];
      if (graphs.length === 0) {
        graphs.unshift(MAIN_BOARD_ID);
      }

      this.#graphRenderer.resetAllSelectionStates();
      for (const id of graphs) {
        const subGraphId = id === MAIN_BOARD_ID ? null : id;
        let selectedGraph = this.graph;
        if (id !== MAIN_BOARD_ID) {
          const subGraphs = this.graph.graphs();
          if (subGraphs && subGraphs[id]) {
            selectedGraph = subGraphs[id];
          }
        }

        await handleGraph(url, subGraphId, selectedGraph);
      }
    }

    // Always avoid animating if the user prefers it without.
    if (
      !this.showSubgraphsInline ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      shouldAnimate = false;
    }

    if (shouldAnimate) {
      this.#graphRenderer.moveToSelection(true);
    } else {
      requestAnimationFrame(() => {
        this.#graphRenderer.moveToSelection(false);
      });
    }

    return this.#graphRenderer;
  }

  constructor() {
    super();

    this.zoomToHighlightedNode =
      (globalThis.localStorage.getItem(ZOOM_KEY) ?? "true") === "true";
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);

    this.#graphRenderer.addEventListener(
      WorkspaceSelectionStateEvent.eventName,
      this.#onWorkspaceSelectionStateChangeBound
    );

    this.#graphRenderer.addEventListener(
      WorkspaceVisualUpdateEvent.eventName,
      this.#onWorkspaceVisualUpdateChangeBound
    );

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

    this.#graphRenderer.addEventListener(
      GraphNodeRunRequestEvent.eventName,
      this.#onGraphNodeRunRequestBound
    );

    this.addEventListener("pointermove", this.#onPointerMoveBound);
    this.addEventListener("pointerdown", this.#onPointerDownBound);
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);

    const commands: Command[] = [
      {
        name: "zoom-to-fit",
        title: "Zoom board to fit",
        icon: "fit",
        callback: () => {
          this.#graphRenderer.zoomToFit(0, this.subGraphId);
        },
      },
      {
        name: "reset-board-layout",
        title: "Reset board layout",
        icon: "reset-nodes",
        callback: () => {
          this.#graphRenderer.resetGraphLayout();
        },
      },
    ];

    this.dispatchEvent(
      new CommandsAvailableEvent(COMMAND_SET_GRAPH_EDITOR, commands)
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();

    this.#graphRenderer.removeEventListener(
      WorkspaceSelectionStateEvent.eventName,
      this.#onWorkspaceSelectionStateChangeBound
    );

    this.#graphRenderer.removeEventListener(
      WorkspaceVisualUpdateEvent.eventName,
      this.#onWorkspaceVisualUpdateChangeBound
    );

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

    this.#graphRenderer.removeEventListener(
      GraphNodeRunRequestEvent.eventName,
      this.#onGraphNodeRunRequestBound
    );

    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (this.#lastVisualChangeId && changedProperties.has("visualChangeId")) {
      return this.#lastVisualChangeId !== this.visualChangeId;
    }

    if (
      this.#lastSelectionChangeId &&
      changedProperties.has("selectionState")
    ) {
      return (
        this.#lastSelectionChangeId !== this.selectionState?.selectionChangeId
      );
    }

    return true;
  }

  #currentGraphUrl: string | null = null;
  protected willUpdate(): void {
    const graphUrl = this.graph?.raw().url ?? null;
    if (this.#currentGraphUrl !== graphUrl) {
      this.#currentGraphUrl = graphUrl;
      this.#graphRenderer.deleteGraphs();
    }
  }

  #onWorkspaceSelectionStateChange(evt: Event) {
    const selectionEvt = evt as WorkspaceSelectionStateEvent;
    this.#lastSelectionChangeId = selectionEvt.selectionChangeId;
  }

  #onWorkspaceVisualUpdateChange(evt: Event) {
    const visualEvt = evt as WorkspaceVisualUpdateEvent;
    this.#lastVisualChangeId = visualEvt.visualChangeId;
  }

  #onGraphInteraction() {
    this.dispatchEvent(new InteractionEvent());

    // Only switch off the flag if there is a run active.
    if (!this.topGraphResult?.currentNode) {
      return;
    }

    this.zoomToHighlightedNode = false;
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
        commentEvt.subGraphId
      )
    );
  }

  #onGraphNodeRunRequest(evt: Event) {
    const runRequestEvt = evt as GraphNodeRunRequestEvent;
    this.dispatchEvent(
      new NodeRunRequestEvent(runRequestEvt.id, runRequestEvt.subGraphId)
    );
  }

  #onPointerMove(evt: PointerEvent) {
    const pointer = {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    const location = this.#graphRenderer.toContainerCoordinates(pointer);
    this.dispatchEvent(
      new EditorPointerPositionChangeEvent(location.x, location.y)
    );
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

  #onGraphEdgeAttach(evt: Event) {
    const { edge, subGraphId } = evt as GraphEdgeAttachEvent;
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
        subGraphId
      )
    );
  }

  #onGraphEdgeDetach(evt: Event) {
    const { edge, subGraphId } = evt as GraphEdgeDetachEvent;
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
        subGraphId
      )
    );
  }

  #onGraphEdgeChange(evt: Event) {
    const { fromEdge, toEdge, subGraphId } = evt as GraphNodeEdgeChangeEvent;
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
        subGraphId
      )
    );
  }

  #onGraphNodeDelete(evt: Event) {
    const { id, subGraphId } = evt as GraphNodeDeleteEvent;
    this.dispatchEvent(new NodeDeleteEvent(id, subGraphId));
  }

  #onGraphNodeEdit(evt: Event) {
    const {
      id,
      port,
      selectedPort,
      x,
      y,
      subGraphId,
      addHorizontalClickClearance,
    } = evt as GraphNodeEditEvent;

    this.dispatchEvent(
      new NodeConfigurationUpdateRequestEvent(
        id,
        subGraphId,
        port,
        selectedPort,
        x,
        y,
        addHorizontalClickClearance
      )
    );
  }

  #onGraphEdgeValueSelected(evt: Event) {
    const { info, schema, edge, x, y } = evt as GraphEdgeValueSelectedEvent;
    this.dispatchEvent(new EdgeValueSelectedEvent(info, schema, edge, x, y));
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

    const id = createRandomID(type);
    const configuration = getDefaultConfiguration(type);
    const pointer = {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    const location = this.#graphRenderer.toContainerCoordinates(pointer);
    this.dispatchEvent(
      new NodeCreateEvent(id, type, this.subGraphId, configuration, {
        visual: {
          x: location.x - 100,
          y: location.y - 50,
          collapsed: this.collapseNodesByDefault,
        },
      })
    );
  }

  zoomToFit(reduceRenderBoundsWidth = 0, subGraphId: string | null = null) {
    this.#graphRenderer.zoomToFit(reduceRenderBoundsWidth, subGraphId);
  }

  zoomToNode(id: string, subGraphId: string | null, offset = 0) {
    this.#graphRenderer.zoomToNode(id, subGraphId, offset);
  }

  render() {
    this.#graphRenderer.topGraphResult = this.subGraphId
      ? null
      : this.topGraphResult;

    if (this.#graphRenderer) {
      this.#graphRenderer.invertZoomScrollDirection =
        this.invertZoomScrollDirection;
    }

    const isRunning = this.topGraphResult
      ? this.topGraphResult.status === "running" ||
        this.topGraphResult.status === "paused"
      : false;

    let isInputPending = false;
    let isError = false;
    const eventCount = this.run?.events.length ?? 0;
    const newestEvent = this.run?.events.at(-1);
    if (newestEvent) {
      isInputPending =
        newestEvent.type === "node" &&
        newestEvent.node.descriptor.type === "input";
      isError = newestEvent.type === "error";
    }

    const ribbonMenu = html`<bb-graph-ribbon-menu
      .graph=${this.graph}
      .subGraphId=${this.subGraphId}
      .moduleId=${null}
      .dataType=${DATA_TYPE}
      .showExperimentalComponents=${this.showExperimentalComponents}
      .canSave=${this.capabilities && this.capabilities.save}
      .canUndo=${this.canUndo}
      .canRedo=${this.canRedo}
      .readOnly=${this.readOnly}
      .isRunning=${isRunning}
      .follow=${this.zoomToHighlightedNode}
      .eventCount=${eventCount}
      .isInputPending=${isInputPending}
      .isError=${isError}
      .isShowingBoardActivityOverlay=${this.isShowingBoardActivityOverlay}
      @bbzoomtofit=${() => {
        this.#graphRenderer.zoomToFit(
          this.isShowingBoardActivityOverlay ? 400 : 0,
          this.subGraphId
        );
      }}
      @bbresetlayout=${() => {
        this.#graphRenderer.resetGraphLayout();
      }}
      @bbtogglefollow=${() => {
        const shouldZoom = !this.zoomToHighlightedNode;
        this.zoomToHighlightedNode = shouldZoom;
        this.#graphRenderer.zoomToHighlightedNode = shouldZoom;
        globalThis.localStorage.setItem(ZOOM_KEY, shouldZoom.toString());

        if (!shouldZoom) {
          return;
        }

        if (this.topGraphResult?.currentNode) {
          this.#graphRenderer.zoomToNode(
            this.topGraphResult.currentNode.descriptor.id,
            this.subGraphId,
            -0.1
          );
        }
      }}
    ></bb-graph-ribbon-menu>`;

    const graphEditor = html`${until(this.#processGraph())}`;
    const readOnlyFlag =
      this.graph !== null && this.readOnly && this.showReadOnlyLabel
        ? html`<aside id="readonly-overlay">Read-only View</aside>`
        : nothing;

    const content = html`<div id="content">${graphEditor}</div>`;

    return [this.graph ? ribbonMenu : nothing, content, readOnlyFlag];
  }
}
