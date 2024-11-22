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
  GraphIdentifier,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableGraph,
  InspectableNodePorts,
  InspectableRun,
  Kit,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlerMetadata,
  NodeValue,
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
  GraphNodeRunRequestEvent,
  GraphNodesVisualUpdateEvent,
  GraphShowTooltipEvent,
  HideTooltipEvent,
  InteractionEvent,
  MultiEditEvent,
  NodeActivitySelectedEvent,
  NodeConfigurationUpdateRequestEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeRunRequestEvent,
  NodeTypeRetrievalErrorEvent,
  ShowTooltipEvent,
  SubGraphCreateEvent,
} from "../../events/events.js";
import { GraphEdge } from "./graph-edge.js";
import { GraphRenderer } from "./graph-renderer.js";
import { createRandomID, edgeToString } from "./utils.js";

const ZOOM_KEY = "bb-editor-zoom-to-highlighted-node-during-runs";
const DATA_TYPE = "text/plain";
const PASTE_OFFSET = 50;

import { Command, TopGraphRunResult } from "../../types/types.js";
import { GraphAssets } from "./graph-assets.js";
import { COMMAND_SET_GRAPH_EDITOR } from "../../constants/constants.js";
import { GraphOpts } from "./types.js";

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
  #onGraphNodeRunRequestBound = this.#onGraphNodeRunRequest.bind(this);

  #top = 0;
  #left = 0;
  #addButtonRef: Ref<HTMLInputElement> = createRef();

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
  ) {
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

    return {
      url,
      title: selectedGraph.raw().title ?? "Untitled Board",
      subGraphId,
      visible: true,
      showNodeTypeDescriptions: this.showNodeTypeDescriptions,
      showNodePreviewValues: this.showNodePreviewValues,
      collapseNodesByDefault: this.collapseNodesByDefault,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      metadata: selectedGraph.metadata() || {},
    };
  }

  #updateOrCreateGraph(
    opts: GraphOpts,
    listenForDraw: boolean,
    listenForDrawId: GraphIdentifier | null = null
  ) {
    const updated = this.#graphRenderer.updateGraphByUrl(
      opts.url,
      opts.subGraphId,
      opts
    );
    if (updated) {
      this.#graphRenderer.showGraph(opts.url, opts.subGraphId);
      if (this.topGraphResult) {
        this.#graphRenderer.topGraphResult = this.topGraphResult;
      }

      if (this.#zoomOnUpdate) {
        this.#graphRenderer.zoomToFit(false, 0, this.#zoomOnUpdateId);

        this.#zoomOnUpdate = false;
        this.#zoomOnUpdateId = null;
      }
      return;
    }

    if (this.#lastSubGraphId !== opts.subGraphId) {
      // TODO: Need to figure out how to encode the subgraph/node id combo.
      this.#graphRenderer.topGraphResult = null;
    }

    this.#graphRenderer.createGraph(opts);
    if (!listenForDraw) {
      return;
    }

    const onInitialDraw = (evt: Event) => {
      const drawEvt = evt as GraphInitialDrawEvent;
      if (drawEvt.subGraphId !== listenForDrawId) {
        return;
      }

      this.#graphRenderer.showGraph(opts.url, opts.subGraphId);
      this.#graphRenderer.zoomToFit(
        true,
        this.isShowingBoardActivityOverlay ? 400 : 0
      );

      this.#graphRenderer.removeEventListener(
        GraphInitialDrawEvent.eventName,
        onInitialDraw
      );

      // When we're loading a graph from existing results, we need to
      // set the topGraphResult again so that it is applied to the newly
      // created graph.
      if (this.topGraphResult) {
        this.#graphRenderer.topGraphResult = this.topGraphResult;
      }
    };

    this.#graphRenderer.addEventListener(
      GraphInitialDrawEvent.eventName,
      onInitialDraw
    );
  }

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
    this.#graphRenderer.showSubgraphsInline = this.showSubgraphsInline;

    let selectedGraph = this.graph;
    if (this.subGraphId) {
      const subgraphs = selectedGraph.graphs();
      if (subgraphs && subgraphs[this.subGraphId]) {
        selectedGraph = subgraphs[this.subGraphId];
      } else {
        // This may happen when we were in the subgraph,
        // and it was just deleted, so we short-circuit the rendering
        // to main graph.
        this.#graphRenderer.deleteGraphs();
        return this.#graphRenderer;
      }
    }

    // Force a reset when the board changes.
    const mainGraphUrl = this.graph.raw().url ?? "";
    const url = this.subGraphId
      ? `${mainGraphUrl}#${this.subGraphId}`
      : mainGraphUrl;

    const graphVersion = this.#graphVersion;
    const mainGraphOpts = await this.#inspectableGraphToConfig(
      url,
      this.subGraphId,
      selectedGraph
    );

    if (!selectedGraph) {
      return this.#graphRenderer;
    }

    const subGraphs = new Map<string, GraphOpts>();
    if (this.showSubgraphsInline) {
      for (const [id, subGraph] of Object.entries(
        selectedGraph.graphs() || {}
      )) {
        const subGraphUrl = `${url}-${id}`;
        const subGraphOpts = await this.#inspectableGraphToConfig(
          subGraphUrl,
          id,
          subGraph
        );

        subGraphs.set(id, subGraphOpts);
      }
    }

    // A newer graph has arrived - bail.
    if (graphVersion !== this.#graphVersion) {
      return this.#graphRenderer;
    }

    this.#graphRenderer.hideAllGraphs();
    this.#graphRenderer.removeGraphs(this.tabURLs);

    const shouldListenForMainGraph =
      this.subGraphId !== null || subGraphs.size === 0;
    const mainGraphId = this.subGraphId !== null ? this.subGraphId : null;

    this.#updateOrCreateGraph(
      mainGraphOpts,
      shouldListenForMainGraph,
      mainGraphId
    );

    let s = 0;
    for (const [id, subGraphOpts] of subGraphs) {
      const shouldListenForSubGraph = s === subGraphs.size - 1;
      this.#updateOrCreateGraph(subGraphOpts, shouldListenForSubGraph, id);
      s++;
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

    this.#graphRenderer.addEventListener(
      GraphNodeRunRequestEvent.eventName,
      this.#onGraphNodeRunRequestBound
    );

    window.addEventListener("resize", this.#onResizeBound);
    this.addEventListener("keydown", this.#onKeyDownBound);
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
          this.#graphRenderer.zoomToFit();
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

    this.#graphRenderer.removeEventListener(
      GraphNodeRunRequestEvent.eventName,
      this.#onGraphNodeRunRequestBound
    );

    window.removeEventListener("resize", this.#onResizeBound);
    this.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);
  }

  #zoomOnUpdate = false;
  #zoomOnUpdateId: GraphIdentifier | null = null;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("subGraphId") ||
      changedProperties.has("showSubgraphsInline")
    ) {
      if (!this.showSubgraphsInline) {
        this.#zoomOnUpdate = true;
        this.#zoomOnUpdateId = this.subGraphId;
      }
    }
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
        const graphId = this.subGraphId || "";
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
                  id: createRandomID(data),
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
              node.id = createRandomID(node.type);
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

            edits.push({ type: "addnode", node, graphId });
          }

          for (const edge of graph.edges) {
            if (!this.#isEdge(edge)) {
              continue;
            }

            const newEdge: Edge = {
              from: remappedNodeIds.get(edge.from) ?? edge.from,
              to: remappedNodeIds.get(edge.to) ?? edge.to,
              in: edge.in ?? "MISSING_WIRE",
              out: edge.out ?? "MISSING_WIRE",
            };

            if (edge.constant) {
              newEdge.constant = edge.constant;
            }

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
            edits.push({ type: "addedge", edge: newEdge, graphId });
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
                comment.id = createRandomID("comment");
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
              graphId,
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

    const graphId = moveEvt.subGraphId || "";
    let targetGraph = this.graph;
    if (targetGraph && graphId) {
      const subGraphs = targetGraph.graphs();
      if (!subGraphs) {
        return;
      }

      targetGraph = subGraphs[graphId];
    }

    const editsEvt = new MultiEditEvent(
      moveEvt.nodes.map((node) => {
        switch (node.type) {
          case "node": {
            const graphNode = targetGraph?.nodeById(node.id);
            const metadata = (graphNode?.metadata() || {}) as Record<
              string,
              unknown
            >;

            return {
              type: "changemetadata",
              graphId,
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
            if (!targetGraph) {
              throw new Error("No active graph - unable to update");
            }

            const metadata = targetGraph.metadata() || {};
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
              graphId,
              metadata,
            };
          }
        }
      }),
      `Node multimove: ${label}`,
      moveEvt.subGraphId
    );

    if (this.readOnly) {
      return;
    }

    this.dispatchEvent(editsEvt);
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

  #onGraphEntityRemove(evt: Event) {
    const { nodes, edges, comments, subGraphId } =
      evt as GraphEntityRemoveEvent;
    const edits: EditSpec[] = [];

    const graphId = subGraphId || "";

    // Remove edges first.
    for (const edge of edges) {
      edits.push({
        type: "removeedge",
        graphId,
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
      edits.push({ type: "removenode", id, graphId });
    }

    // Remove comments.
    let graph = this.graph?.raw();
    if (subGraphId && graph?.graphs) {
      graph = graph.graphs[subGraphId];
    }
    if (graph && graph.metadata) {
      graph.metadata.comments ??= [];
      graph.metadata.comments = graph.metadata.comments.filter(
        (comment) => !comments.includes(comment.id)
      );
      edits.push({
        type: "changegraphmetadata",
        metadata: graph.metadata,
        graphId,
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
        subGraphId
      )
    );
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

  zoomToFit(
    emitGraphNodeVisualInformation = true,
    reduceRenderBoundsWidth = 0,
    subGraphId: string | null = null
  ) {
    this.#graphRenderer.zoomToFit(
      emitGraphNodeVisualInformation,
      reduceRenderBoundsWidth,
      subGraphId
    );
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
      @bbnodecreate=${() => {
        this.#graphRenderer.deselectAllChildren();
      }}
      @bbzoomtofit=${() => {
        this.#graphRenderer.zoomToFit(
          true,
          this.isShowingBoardActivityOverlay ? 400 : 0
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
      @bbaddsubgraph=${() => {
        this.#proposeNewSubGraph();
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
