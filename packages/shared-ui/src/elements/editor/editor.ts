/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  BreadboardCapability,
  GraphIdentifier,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableGraph,
  InspectableNodePorts,
  InspectableRun,
  isGraphDescriptorCapability,
  isResolvedURLBoardCapability,
  isUnresolvedPathBoardCapability,
  NodeConfiguration,
  NodeHandlerMetadata,
  NodeIdentifier,
  PortIdentifier,
} from "@google-labs/breadboard";
import { LitElement, PropertyValues, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
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
  NodeCreateReferenceEvent,
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
  DragConnectorReceiver,
  TopGraphRunResult,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  MAIN_BOARD_ID,
} from "../../constants/constants.js";
import { GraphNodeReferenceOpts, GraphReferences, GraphOpts } from "./types.js";
import { isBoardArrayBehavior, isBoardBehavior } from "../../utils/index.js";
import { getSubItemColor } from "../../utils/subgraph-color.js";

import "./graph-renderer.js";

const ZOOM_KEY = "bb-editor-zoom-to-highlighted-node-during-runs";
const DATA_TYPE = "text/plain";
const RIBBON_HEIGHT = 44;
const EDITOR_PADDING = 100;

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
export class Editor extends LitElement implements DragConnectorReceiver {
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

  @property({ reflect: true })
  hideRibbonMenu = false;

  @property()
  topGraphResult: TopGraphRunResult | null = null;

  @state()
  nodeValueBeingEdited: EditedNode | null = null;

  @state()
  defaultConfiguration: NodeConfiguration | null = null;

  @property({ reflect: true })
  invertZoomScrollDirection = false;

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
  graphTopologyUpdateId: number = 0;

  @property()
  showPortTooltips = false;

  @property()
  zoomToHighlightedNode = false;

  @property()
  isShowingBoardActivityOverlay = false;

  @property()
  showBoardReferenceMarkers = false;

  @state()
  showOverflowMenu = false;

  @property()
  boardServers: BoardServer[] = [];

  #graphRendererRef: Ref<GraphRenderer> = createRef();

  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onWorkspaceSelectionStateChangeBound =
    this.#onWorkspaceSelectionStateChange.bind(this);
  #onWorkspaceVisualUpdateChangeBound =
    this.#onWorkspaceVisualUpdateChange.bind(this);

  // TODO: Remove these in favour of direct events.
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
    }

    :host([hideRibbonMenu="false"]) {
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

    :host([hideRibbonMenu="true"]) bb-graph-ribbon-menu {
      display: none;
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

  #getBoardTitle(boardUrl: string): string {
    const expandedUrl = new URL(boardUrl, window.location.href);
    for (const boardServer of this.boardServers) {
      if (!boardServer.canProvide(expandedUrl)) {
        continue;
      }

      for (const store of boardServer.items().values()) {
        for (const [title, { url }] of store.items) {
          if (url !== expandedUrl.href) {
            continue;
          }

          return title ?? boardUrl;
        }
      }
    }

    return boardUrl;
  }

  #inspectableGraphToConfig(
    url: string,
    subGraphId: string | null,
    selectedGraph: InspectableGraph
  ): GraphOpts {
    const references: GraphReferences = new Map<
      NodeIdentifier,
      Map<PortIdentifier, GraphNodeReferenceOpts>
    >();

    const pushReference = (
      nodeId: NodeIdentifier,
      portId: PortIdentifier,
      reference: string | BreadboardCapability | null
    ) => {
      if (!reference) return;

      if (typeof reference === "object") {
        if (isGraphDescriptorCapability(reference)) {
          return;
        }

        if (isResolvedURLBoardCapability(reference)) {
          reference = reference.url;
        } else if (isUnresolvedPathBoardCapability(reference)) {
          reference = reference.path;
        }
      }

      let ref = reference;
      let title: string;

      if (reference.startsWith("#")) {
        if (reference.startsWith("#module:") && this.graph?.modules()) {
          ref = reference.slice("#module:".length);
          const module = this.graph.moduleById(ref);
          title = module?.metadata().title ?? "Untitled module";
        } else if (this.graph?.graphs()) {
          ref = reference.slice(1);

          const subGraph = this.graph.graphs()?.[ref];
          title = subGraph?.raw().title ?? "Untitled board";
        } else {
          title = "Untitled item";
        }
      } else {
        const boardTitle = this.#getBoardTitle(reference);
        if (boardTitle !== reference) {
          title = boardTitle;
        } else {
          title = reference.split("/").at(-1) as string;
        }
      }

      let nodeRefs = references.get(nodeId);
      if (!nodeRefs) {
        nodeRefs = new Map<PortIdentifier, GraphNodeReferenceOpts>();
        references.set(nodeId, nodeRefs);
      }

      let nodeRefValues = nodeRefs.get(portId);
      if (!nodeRefValues) {
        nodeRefValues = [];
        nodeRefs.set(portId, nodeRefValues);
      }

      nodeRefValues.push({
        title,
        color: getSubItemColor<number>(ref, "label", true),
        reference,
      });
    };

    const ports = new Map<PortIdentifier, InspectableNodePorts>();
    const typeMetadata = new Map<string, NodeHandlerMetadata>();
    for (const node of selectedGraph.nodes()) {
      const currentPorts = node.currentPorts();
      ports.set(node.descriptor.id, currentPorts);
      for (const port of currentPorts.inputs.ports) {
        if (!port.value) {
          continue;
        }

        if (isBoardBehavior(port.schema) || isBoardArrayBehavior(port.schema)) {
          if (Array.isArray(port.value)) {
            for (const reference of port.value) {
              pushReference(
                node.descriptor.id,
                port.name,

                reference as string
              );
            }
          } else {
            pushReference(node.descriptor.id, port.name, port.value as string);
          }
        }
      }

      try {
        typeMetadata.set(node.descriptor.type, node.type().currentMetadata());
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

    const hasSubGraphs = Object.keys(selectedGraph.graphs() ?? {}).length > 0;

    return {
      url,
      title: subGraphId
        ? (selectedGraph.raw().title ?? "Untitled Board")
        : "Main",
      subGraphId,
      minimized: (selectedGraph.metadata() || {}).visual?.minimized ?? false,
      showNodePreviewValues: this.showNodePreviewValues,
      collapseNodesByDefault: this.collapseNodesByDefault,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      modules: selectedGraph.modules(),
      metadata: selectedGraph.metadata() || {},
      showGraphOutline: subGraphId ? true : hasSubGraphs,
      references,
      selectionState: graphSelectionState ?? null,
    };
  }

  constructor() {
    super();

    this.zoomToHighlightedNode =
      (globalThis.localStorage.getItem(ZOOM_KEY) ?? "true") === "true";
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);

    this.addEventListener(
      WorkspaceSelectionStateEvent.eventName,
      this.#onWorkspaceSelectionStateChangeBound
    );

    this.addEventListener(
      WorkspaceVisualUpdateEvent.eventName,
      this.#onWorkspaceVisualUpdateChangeBound
    );

    this.addEventListener(
      GraphEdgeAttachEvent.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.addEventListener(
      GraphEdgeDetachEvent.eventName,
      this.#onGraphEdgeDetachBound
    );

    this.addEventListener(
      GraphNodeEdgeChangeEvent.eventName,
      this.#onGraphEdgeChangeBound
    );

    this.addEventListener(
      GraphNodeDeleteEvent.eventName,
      this.#onGraphNodeDeleteBound
    );

    this.addEventListener(
      GraphNodeEditEvent.eventName,
      this.#onGraphNodeEditBound
    );

    this.addEventListener(
      GraphEdgeValueSelectedEvent.eventName,
      this.#onGraphEdgeValueSelectedBound
    );

    this.addEventListener(
      GraphNodeActivitySelectedEvent.eventName,
      this.#onGraphNodeActivitySelectedBound
    );

    this.addEventListener(
      GraphInteractionEvent.eventName,
      this.#onGraphInteractionBound
    );

    this.addEventListener(
      GraphShowTooltipEvent.eventName,
      this.#onGraphShowTooltipBound
    );

    this.addEventListener(
      GraphHideTooltipEvent.eventName,
      this.#onGraphHideTooltipBound
    );

    this.addEventListener(
      GraphCommentEditRequestEvent.eventName,
      this.#onGraphCommentEditRequestBound
    );

    this.addEventListener(
      GraphNodeRunRequestEvent.eventName,
      this.#onGraphNodeRunRequestBound
    );

    this.addEventListener("pointermove", this.#onPointerMoveBound);
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);

    const commands: Command[] = [];
    this.dispatchEvent(
      new CommandsAvailableEvent(COMMAND_SET_GRAPH_EDITOR, commands)
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();

    this.removeEventListener(
      WorkspaceSelectionStateEvent.eventName,
      this.#onWorkspaceSelectionStateChangeBound
    );

    this.removeEventListener(
      WorkspaceVisualUpdateEvent.eventName,
      this.#onWorkspaceVisualUpdateChangeBound
    );

    this.removeEventListener(
      GraphEdgeAttachEvent.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.removeEventListener(
      GraphEdgeDetachEvent.eventName,
      this.#onGraphEdgeDetachBound
    );

    this.removeEventListener(
      GraphNodeEdgeChangeEvent.eventName,
      this.#onGraphEdgeChangeBound
    );

    this.removeEventListener(
      GraphNodeDeleteEvent.eventName,
      this.#onGraphNodeDeleteBound
    );

    this.removeEventListener(
      GraphNodeEditEvent.eventName,
      this.#onGraphNodeEditBound
    );

    this.removeEventListener(
      GraphEdgeValueSelectedEvent.eventName,
      this.#onGraphEdgeValueSelectedBound
    );

    this.removeEventListener(
      GraphNodeActivitySelectedEvent.eventName,
      this.#onGraphNodeActivitySelectedBound
    );

    this.removeEventListener(
      GraphInteractionEvent.eventName,
      this.#onGraphInteractionBound
    );

    this.removeEventListener(
      GraphShowTooltipEvent.eventName,
      this.#onGraphShowTooltipBound
    );

    this.removeEventListener(
      GraphHideTooltipEvent.eventName,
      this.#onGraphHideTooltipBound
    );

    this.removeEventListener(
      GraphCommentEditRequestEvent.eventName,
      this.#onGraphCommentEditRequestBound
    );

    this.removeEventListener(
      GraphNodeRunRequestEvent.eventName,
      this.#onGraphNodeRunRequestBound
    );

    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);
  }

  #lastGraphUrl: string | null = null;
  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has("graph")) {
      const graphUrl = this.graph?.raw().url;
      const matches = graphUrl === this.#lastGraphUrl;
      if (!matches) {
        this.#lastGraphUrl = graphUrl ?? null;
        return true;
      }
    }

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

  #configs = new Map<GraphIdentifier, GraphOpts>();
  protected willUpdate(): void {
    this.#configs = this.#convertGraphsToConfigs(this.graph);
  }

  #convertGraphsToConfigs(
    graph: InspectableGraph | null
  ): Map<GraphIdentifier, GraphOpts> {
    const configs = new Map<GraphIdentifier, GraphOpts>();
    if (!graph) {
      return configs;
    }

    const url = graph.raw().url ?? "no-url";
    if (this.showSubgraphsInline) {
      configs.set(
        MAIN_BOARD_ID,
        this.#inspectableGraphToConfig(url, null, graph)
      );

      for (const [id, subGraph] of Object.entries(graph.graphs() || {})) {
        configs.set(id, this.#inspectableGraphToConfig(url, id, subGraph));
      }
    } else {
      if (this.selectionState?.selectionState) {
        if (this.selectionState?.selectionState.graphs.size === 0) {
          configs.set(
            MAIN_BOARD_ID,
            this.#inspectableGraphToConfig(url, null, graph)
          );
        } else {
          for (const id of this.selectionState.selectionState.graphs.keys()) {
            let targetGraph = graph;
            if (id !== MAIN_BOARD_ID) {
              const subGraphs = graph.graphs();
              if (!subGraphs) {
                continue;
              }
              targetGraph = subGraphs[id];
            }

            if (!targetGraph) {
              continue;
            }

            configs.set(
              id,
              this.#inspectableGraphToConfig(
                url,
                id === MAIN_BOARD_ID ? null : id,
                targetGraph
              )
            );
          }
        }
      } else {
        configs.set(
          MAIN_BOARD_ID,
          this.#inspectableGraphToConfig(url, null, graph)
        );
      }
    }

    return configs;
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
    if (!this.#graphRendererRef.value) {
      return;
    }

    const pointer = {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    const location =
      this.#graphRendererRef.value.toContainerCoordinates(pointer);
    this.dispatchEvent(
      new EditorPointerPositionChangeEvent(location.x, location.y)
    );
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

    if (!this.#graphRendererRef.value) {
      return;
    }

    const pointer = {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    this.#graphRendererRef.value.removeSubGraphHighlights();
    this.#graphRendererRef.value.highlightSubGraphId(pointer);

    this.#graphRendererRef.value.removeBoardPortHighlights();
    this.#graphRendererRef.value.highlightBoardPort(pointer);
  }

  #onDrop(evt: DragEvent) {
    const [top] = evt.composedPath();
    if (!(top instanceof HTMLCanvasElement)) {
      return;
    }

    evt.preventDefault();

    const type = evt.dataTransfer?.getData(DATA_TYPE);
    if (!type || !this.#graphRendererRef.value) {
      return;
    }

    this.#graphRendererRef.value.removeSubGraphHighlights();
    this.#graphRendererRef.value.removeBoardPortHighlights();

    const pointer = {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    // The user has dropped the item onto a board port.
    if (URL.canParse(type) || type.startsWith("#")) {
      const boardPort =
        this.#graphRendererRef.value.intersectingBoardPort(pointer);

      if (boardPort) {
        this.dispatchEvent(
          new NodeCreateReferenceEvent(
            boardPort.graphId,
            boardPort.nodeId,
            boardPort.portId,
            type
          )
        );
        return;
      }
    }

    // The user has dropped the item onto the board proper.
    const id = createRandomID(type);
    const configuration = getDefaultConfiguration(type);

    const location =
      this.#graphRendererRef.value.toContainerCoordinates(pointer);
    const subGraph = this.#graphRendererRef.value.toSubGraphId(pointer);

    this.dispatchEvent(
      new NodeCreateEvent(id, type, subGraph, configuration, {
        visual: {
          x: location.x - 100,
          y: location.y - 50,
          collapsed: this.collapseNodesByDefault,
        },
      })
    );
  }

  isOnDragConnectorTarget(x: number, y: number): string | null {
    if (!this.#graphRendererRef.value) {
      return null;
    }

    const pointer = {
      x: x - this.#left + window.scrollX,
      y: y - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    const boardPort =
      this.#graphRendererRef.value.intersectingBoardPort(pointer);

    if (boardPort) {
      return `${boardPort.graphId}|${boardPort.nodeId}|${boardPort.portId}`;
    }

    return null;
  }

  highlight(x: number, y: number): void {
    if (!this.#graphRendererRef.value) {
      return;
    }

    const pointer = {
      x: x - this.#left + window.scrollX,
      y: y - this.#top - window.scrollY - RIBBON_HEIGHT,
    };

    this.#graphRendererRef.value.removeBoardPortHighlights();
    this.#graphRendererRef.value.highlightBoardPort(pointer);
  }

  removeHighlight(): void {
    if (!this.#graphRendererRef.value) {
      return;
    }

    this.#graphRendererRef.value.removeBoardPortHighlights();
  }

  render() {
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
      ?hidden=${this.hideRibbonMenu}
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
        if (!this.#graphRendererRef.value) {
          return;
        }

        let animate = true;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          animate = false;
        }
        this.#graphRendererRef.value.zoomToFit(animate);
      }}
    ></bb-graph-ribbon-menu>`;

    const readOnlyFlag =
      this.graph !== null && this.readOnly && this.showReadOnlyLabel
        ? html`<aside id="readonly-overlay">Read-only View</aside>`
        : nothing;

    const content = html`<div id="content">
      <bb-graph-renderer
        ${ref(this.#graphRendererRef)}
        .topGraphUrl=${this.graph?.raw().url ?? "no-url"}
        .topGraphResult=${this.topGraphResult}
        .assetPrefix=${this.assetPrefix}
        .graphTopologyUpdateId=${this.graphTopologyUpdateId}
        .configs=${this.#configs}
        .invertZoomScrollDirection=${this.invertZoomScrollDirection}
        .readOnly=${this.readOnly}
        .highlightInvalidWires=${this.highlightInvalidWires}
        .showPortTooltips=${this.showPortTooltips}
        .showSubgraphsInline=${this.showSubgraphsInline}
        .selectionChangeId=${this.selectionState?.selectionChangeId}
        .moveToSelection=${this.selectionState?.moveToSelection}
        .showBoardReferenceMarkers=${this.showBoardReferenceMarkers}
        .padding=${EDITOR_PADDING}
      ></bb-graph-renderer>
    </div>`;

    return [this.graph ? ribbonMenu : nothing, content, readOnlyFlag];
  }
}
