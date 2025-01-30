/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Editor");

import {
  BoardServer,
  BreadboardCapability,
  EditSpec,
  GraphIdentifier,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphStoreEntry,
  GraphStoreUpdateEvent,
  InspectableGraph,
  InspectableNodePorts,
  InspectableRun,
  isGraphDescriptorCapability,
  isResolvedURLBoardCapability,
  isUnresolvedPathBoardCapability,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeConfiguration,
  NodeHandlerMetadata,
  NodeIdentifier,
  PortIdentifier,
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
  GraphNodeQuickAddEvent,
  GraphNodeRunRequestEvent,
  GraphShowTooltipEvent,
  HideTooltipEvent,
  InteractionEvent,
  KitNodeChosenEvent,
  MultiEditEvent,
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
import { createRandomID, GRID_SIZE } from "./utils.js";
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
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { NodeMetadata } from "@breadboard-ai/types";

const ZOOM_KEY = "bb-editor-zoom-to-highlighted-node-during-runs";
const DATA_TYPE = "text/plain";
const EDITOR_PADDING = 100;
const GRAPH_NODE_WIDTH = 260;
const GRAPH_NODE_QUICK_ADD_GAP = 60;
const QUICK_ADD_ADJUSTMENT = 40;
const HEADER_PORT_ADJSUTMENT = 20;
const QUICK_ADD_HEIGHT = 400;
const HEADER_HEIGHT = 44;

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
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor boardServerKits: Kit[] | null = null;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property()
  accessor graphStoreUpdateId = 0;

  @property()
  accessor run: InspectableRun | null = null;

  @property()
  accessor offsetZoom = 0;

  @property()
  accessor boardId: number = -1;

  @property()
  accessor capabilities: false | GraphProviderCapabilities = false;

  @property()
  accessor extendedCapabilities: false | GraphProviderExtendedCapabilities =
    false;

  @property()
  accessor canUndo = false;

  @property()
  accessor canRedo = false;

  @property()
  accessor collapseNodesByDefault = false;

  @property()
  accessor hideSubboardSelectorWhenEmpty = false;

  @property()
  accessor showNodeShortcuts = true;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @state()
  accessor nodeValueBeingEdited: EditedNode | null = null;

  @state()
  accessor defaultConfiguration: NodeConfiguration | null = null;

  @property({ reflect: true })
  accessor invertZoomScrollDirection = false;

  @property()
  accessor showNodePreviewValues = true;

  @property()
  accessor assetPrefix = "";

  @property()
  accessor showControls = true;

  @property()
  accessor showReadOnlyLabel = true;

  @property()
  accessor readOnly = false;

  @property()
  accessor showReadOnlyOverlay = false;

  @property()
  accessor highlightInvalidWires = false;

  @property()
  accessor showExperimentalComponents = false;

  @property()
  accessor showSubgraphsInline = true;

  @property()
  accessor tabURLs: string[] = [];

  @property()
  accessor showBoardHierarchy = true;

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  accessor visualChangeId: WorkspaceVisualChangeId | null = null;

  @property()
  accessor graphTopologyUpdateId: number = 0;

  @property()
  accessor showPortTooltips = false;

  @property()
  accessor zoomToHighlightedNode = false;

  @property()
  accessor isShowingBoardActivityOverlay = false;

  @property()
  accessor showBoardReferenceMarkers = false;

  @state()
  accessor showOverflowMenu = false;

  @property()
  accessor boardServers: BoardServer[] = [];

  @state()
  accessor showComponentLibrary = false;
  #componentLibraryConfiguration: {
    x: number;
    y: number;
    id: NodeIdentifier;
    portId: PortIdentifier;
    freeDrop: boolean;
    subGraphId: GraphIdentifier | null;
  } | null = null;

  @state()
  accessor showComponentPicker = false;
  #componentPickerConfiguration: {
    components: Array<{ id: string; metadata: GraphStoreEntry }>;
    x: number;
    y: number;
  } = {
    components: [],
    x: 0,
    y: 0,
  };

  #graphRendererRef: Ref<GraphRenderer> = createRef();

  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
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
  #onGraphNodeQuickAddBound = this.#onGraphNodeQuickAdd.bind(this);

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
    @keyframes slideIn {
      from {
        opacity: 0;
        translate: 0 -10px;
      }

      to {
        opacity: 1;
        translate: none;
      }
    }

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

    #readonly-overlay {
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-7);
      position: absolute;
      top: 16px;
      left: 16px;
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

    #content {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
      position: relative;
    }

    #component-picker {
      position: fixed;
      left: var(--component-picker-x, 100px);
      top: var(--component-picker-y, 100px);
      z-index: 3;
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
      width: 172px;
      border-radius: var(--bb-grid-size-2);
      box-shadow: var(--bb-elevation-5);
      animation: slideIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

      .no-components-available {
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);

        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
      }

      ul#components {
        margin: 0;
        padding: 0;
        list-style: none;

        & li {
          display: grid;
          grid-template-columns: 20px 1fr;
          column-gap: var(--bb-grid-size-2);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          cursor: pointer;
          position: relative;

          &::before {
            content: "";
            position: absolute;
            display: block;
            left: 2px;
            top: 2px;
            width: calc(100% - 4px);
            height: calc(100% - 4px);
            background: var(--bb-neutral-50);
            z-index: 0;
            border-radius: var(--bb-grid-size);
            opacity: 0;
            transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
          }

          &:hover::before {
            opacity: 1;
          }

          & .node-id {
            position: relative;
            color: var(--bb-neutral-900);
            margin-bottom: var(--bb-grid-size);
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);
          }

          & .node-icon {
            position: relative;
            width: 20px;
            height: 20px;
            border-radius: 4px;
            background: transparent var(--bb-icon-board) top left / 20px 20px
              no-repeat;

            &.code-blocks {
              background: var(--bb-icon-code-blocks) top left / 20px 20px
                no-repeat;
            }

            &.smart-toy {
              background: var(--bb-icon-smart-toy) top left / 20px 20px
                no-repeat;
            }

            &.human {
              background: var(--bb-icon-human) top left / 20px 20px no-repeat;
            }

            &.merge-type {
              background: var(--bb-icon-merge-type) top left / 20px 20px
                no-repeat;
            }

            &.laps {
              background: var(--bb-icon-laps) top left / 20px 20px no-repeat;
            }

            &.google-drive {
              background: var(--bb-icon-google-drive) top left / 20px 20px
                no-repeat;
            }

            &.generative {
              background: var(--bb-add-icon-generative) top left / 20px 20px
                no-repeat;
            }

            &.generative-audio {
              background: var(--bb-add-icon-generative-audio) top left / 20px
                20px no-repeat;
            }

            &.generative-text {
              background: var(--bb-add-icon-generative-text) top left / 20px
                20px no-repeat;
            }

            &.generative-image {
              background: var(--bb-add-icon-generative-image) top left / 20px
                20px no-repeat;
            }
          }
        }
      }
    }

    #floating-buttons {
      position: absolute;
      display: flex;
      top: var(--bb-grid-size-4);
      left: 0;
      width: 100%;
      height: var(--bb-grid-size-9);
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);

      & #run {
        min-width: 76px;
        height: var(--bb-grid-size-9);
        background: var(--bb-ui-500) var(--bb-icon-play-filled-inverted) 8px
          center / 20px 20px no-repeat;
        color: #fff;
        border-radius: 20px;
        border: none;
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-9);
        opacity: 0.3;

        &.running {
          background: var(--bb-ui-500) url(/images/progress-ui-inverted.svg) 8px
            center / 16px 16px no-repeat;
        }

        &:not([disabled]) {
          cursor: pointer;
          opacity: 1;
        }
      }

      & #shelf {
        border-radius: var(--bb-grid-size-16);
        height: 100%;
        display: flex;
        align-items: center;
        padding: 0 var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        background: var(--bb-neutral-0);
        margin: 0 var(--bb-grid-size-4);

        & button {
          font-size: 0;
          width: var(--bb-grid-size-7);
          height: var(--bb-grid-size-9);
          border: none;
          padding: 0 var(--bb-grid-size);
          background: var(--bb-icon-board) center center / 20px 20px no-repeat;
          position: relative;
          opacity: 0.3;

          &:not([disabled]) {
            opacity: 0.6;
            cursor: pointer;
            transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:focus,
            &:hover {
              opacity: 1;
            }
          }

          &#preset-comment {
            background: var(--bb-icon-comment) center center / 20px 20px
              no-repeat;
          }

          &.expandable {
            width: var(--bb-grid-size-12);
            background:
              var(--bb-icon-board) 8px center / 20px 20px no-repeat,
              var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                no-repeat;

            &#preset-all {
              border-right: 1px solid var(--bb-neutral-100);
              background:
                var(--bb-icon-add-box) 8px center / 20px 20px no-repeat,
                var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                  no-repeat;
            }

            &#preset-a2 {
              background:
                var(--bb-add-icon-generative) 10px center / 16px 16px no-repeat,
                var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                  no-repeat;
            }

            &#preset-built-in {
              background:
                var(--bb-icon-route) 8px center / 20px 20px no-repeat,
                var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                  no-repeat;
            }

            &#preset-tools {
              background:
                var(--bb-icon-home-repair-service) 8px center / 20px 20px
                  no-repeat,
                var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                  no-repeat;
            }
          }
        }
      }

      & #controls {
        border-radius: var(--bb-grid-size-16);
        height: 100%;
        display: flex;
        align-items: center;
        padding: 0 var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        background: var(--bb-neutral-0);

        & #zoom-to-fit {
          width: 20px;
          height: 20px;
          font-size: 0;
          background: transparent var(--bb-icon-fit) center center / 20px 20px
            no-repeat;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
          opacity: 0.6;
        }
      }
    }

    bb-graph-renderer {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
    }

    bb-component-selector-overlay {
      position: absolute;
      top: 57px;
      left: 50%;
      transform: translateX(-50%) translateX(40px);
      z-index: 2;
      animation: slideIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

      &[detached="true"] {
        position: fixed;
        left: var(--component-library-x, 100px);
        top: var(--component-library-y, 100px);
        transform: none;
      }
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

    this.addEventListener(
      GraphNodeQuickAddEvent.eventName,
      this.#onGraphNodeQuickAddBound
    );

    window.addEventListener("pointerdown", this.#onPointerDownBound);

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

    this.removeEventListener(
      GraphNodeQuickAddEvent.eventName,
      this.#onGraphNodeQuickAddBound
    );

    window.removeEventListener("pointerdown", this.#onPointerDownBound);

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

  #onGraphNodeQuickAdd(evt: Event) {
    const quickAddEvt = evt as GraphNodeQuickAddEvent;
    this.#componentLibraryConfiguration = {
      x: quickAddEvt.x,
      y: quickAddEvt.y,
      subGraphId: quickAddEvt.subGraphId,
      id: quickAddEvt.id,
      portId: quickAddEvt.portId,
      freeDrop: quickAddEvt.freeDrop,
    };

    this.showComponentLibrary = true;
  }

  #onPointerDown() {
    this.#hidePickers();
  }

  #hidePickers() {
    this.#componentLibraryConfiguration = null;
    this.showComponentLibrary = false;
    this.showComponentPicker = false;
  }

  #onPointerMove(evt: PointerEvent) {
    if (!this.#graphRendererRef.value) {
      return;
    }

    const pointer = {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY,
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
      y: evt.pageY - this.#top - window.scrollY,
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
      y: evt.pageY - this.#top - window.scrollY,
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

    this.showComponentLibrary = false;
    this.showComponentPicker = false;

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
      y: y - this.#top - window.scrollY,
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
      y: y - this.#top - window.scrollY,
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

  #createComponentList(graphStore: MutableGraphStore, kitName: string) {
    const kitList: Array<{ id: string; metadata: GraphStoreEntry }> = [];
    const graphs = graphStore.graphs();

    for (const graph of graphs) {
      if (!graph.title) {
        continue;
      }

      const { mainGraph } = graph;
      if (
        !mainGraph.title ||
        mainGraph.title !== kitName ||
        mainGraph.tags?.includes("deprecated") ||
        !graph.tags?.includes("component") ||
        graph.tags?.includes("deprecated")
      ) {
        continue;
      }

      if (
        !this.showExperimentalComponents &&
        mainGraph.tags?.includes("experimental")
      ) {
        continue;
      }

      if (
        !this.showExperimentalComponents &&
        graph.tags?.includes("experimental")
      ) {
        continue;
      }

      kitList.push({ id: graph.url!, metadata: graph });
    }

    kitList.sort((kit1, kit2) => {
      const title1 = kit1.metadata.mainGraph.title || "";
      const title2 = kit2.metadata.mainGraph.title || "";
      if (title1 > title2) {
        return 1;
      }
      if (title1 < title2) {
        return -1;
      }
      return (kit1.metadata.title || "") > (kit2.metadata.title || "") ? 1 : -1;
    });

    return kitList;
  }

  #showComponentPicker(target: HTMLElement, kitName: string) {
    if (!this.graphStore) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    this.#componentPickerConfiguration = {
      components: this.#createComponentList(this.graphStore, kitName),
      x: bounds.left - 5,
      y: bounds.bottom + 4,
    };

    this.showComponentPicker = !this.showComponentPicker;
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

  #handleChosenKitItem(nodeType: string) {
    if (!this.#graphRendererRef.value) {
      return;
    }

    const edits: EditSpec[] = [];
    const id = createRandomID(nodeType);
    const visual: NodeMetadata["visual"] = {};
    const graphId =
      this.#componentLibraryConfiguration?.subGraphId ?? this.subGraphId ?? "";
    if (this.#componentLibraryConfiguration) {
      if (this.#componentLibraryConfiguration.freeDrop) {
        const { x, y } = this.#graphRendererRef.value.toContainerCoordinates({
          x: this.#componentLibraryConfiguration.x,
          // We adjust the y position here to account for the header height but
          // also the fact that the header port is slightly below the top of the
          // node.
          y:
            this.#componentLibraryConfiguration.y -
            HEADER_HEIGHT -
            HEADER_PORT_ADJSUTMENT,
        });

        visual.x = Math.round(x / GRID_SIZE) * GRID_SIZE;
        visual.y = Math.round(y / GRID_SIZE) * GRID_SIZE;
      } else {
        const sourceVisual = this.graph
          ?.nodeById(this.#componentLibraryConfiguration.id)
          ?.metadata().visual as Record<string, number> | undefined;
        if (sourceVisual) {
          visual.y = sourceVisual.y;
          visual.x =
            sourceVisual.x + GRAPH_NODE_WIDTH + GRAPH_NODE_QUICK_ADD_GAP;
        }
      }
    } else {
      // Middle of the canvas.
      const bounds = this.getBoundingClientRect();
      const location = this.#graphRendererRef.value.toContainerCoordinates({
        x: bounds.x + bounds.width * 0.5,
        y: bounds.y + bounds.height * 0.5,
      });

      visual.x = location.x - GRAPH_NODE_WIDTH / 2;
      visual.y = location.y - QUICK_ADD_ADJUSTMENT;
    }

    const title = this.#getGraphTitleByType(nodeType);

    edits.push({
      type: "addnode",
      graphId,
      node: {
        id,
        type: nodeType,
        metadata: {
          title,
          visual,
        },
      },
    });

    if (this.#componentLibraryConfiguration) {
      const { id: sourceId, portId } = this.#componentLibraryConfiguration;
      // Add an edge.
      edits.push({
        type: "addedge",
        graphId,
        edge: {
          from: sourceId,
          to: id,
          out: portId,
          in: portId,
        },
      });
    }

    this.dispatchEvent(
      new MultiEditEvent(
        edits,
        `Quick Add`,
        this.#componentLibraryConfiguration?.subGraphId ?? null
      )
    );

    if (this.#componentLibraryConfiguration) {
      // By default we will zoom to the currently-selected node. We therefore
      // wait a frame so that the newly-added node is selected.
      requestAnimationFrame(() => {
        if (!this.#graphRendererRef.value) {
          return;
        }

        let animate = true;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          animate = false;
        }

        this.#graphRendererRef.value.zoomToSelectionIfPossible(animate);
      });
    }

    this.#hidePickers();
  }

  render() {
    const readOnlyFlag =
      this.graph !== null && this.readOnly && this.showReadOnlyLabel
        ? html`<aside id="readonly-overlay">Read-only View</aside>`
        : nothing;

    let componentLibrary: HTMLTemplateResult | symbol = nothing;
    if (this.showComponentLibrary) {
      const isDetached = this.#componentLibraryConfiguration !== null;
      if (this.#componentLibraryConfiguration) {
        let { x, y } = this.#componentLibraryConfiguration;
        x -= QUICK_ADD_ADJUSTMENT;
        y -= QUICK_ADD_HEIGHT * 0.5;
        if (y + QUICK_ADD_HEIGHT > window.innerHeight) {
          y = window.innerHeight - QUICK_ADD_HEIGHT - QUICK_ADD_ADJUSTMENT;
        }

        this.style.setProperty("--component-library-x", `${x}px`);
        this.style.setProperty("--component-library-y", `${y}px`);
      } else {
        this.style.removeProperty("--component-library-x");
        this.style.removeProperty("--component-library-y");
      }

      componentLibrary = html`<bb-component-selector-overlay
        .detached=${isDetached}
        .graphStoreUpdateId=${this.graphStoreUpdateId}
        .showExperimentalComponents=${this.showExperimentalComponents}
        .boardServerKits=${this.boardServerKits}
        .graphStore=${this.graphStore}
        .mainGraphId=${this.mainGraphId}
        @bbkitnodechosen=${(evt: KitNodeChosenEvent) =>
          this.#handleChosenKitItem(evt.nodeType)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
      >
      </bb-component-selector-overlay>`;
    }

    let storeReady = Promise.resolve();
    if (this.graphStore) {
      storeReady = new Promise((resolve) => {
        if (!this.graphStore) {
          resolve();
          return;
        }

        const awaitingUpdate = new Set<string>();
        const onGraphUpdate = (evt: GraphStoreUpdateEvent) => {
          if (awaitingUpdate.has(evt.mainGraphId)) {
            awaitingUpdate.delete(evt.mainGraphId);
          }

          if (awaitingUpdate.size === 0) {
            this.graphStore?.removeEventListener(
              "update",
              onGraphUpdate as EventListener
            );
            resolve();
          }
        };

        this.graphStore.addEventListener("update", onGraphUpdate);

        for (const graph of this.graphStore.graphs()) {
          if (!graph.updating) {
            continue;
          }

          awaitingUpdate.add(graph.mainGraph.id);
        }

        if (awaitingUpdate.size === 0) {
          resolve();
        }
      });
    }

    let componentPicker: HTMLTemplateResult | symbol = nothing;
    if (this.showComponentPicker) {
      this.style.setProperty(
        "--component-picker-x",
        `${this.#componentPickerConfiguration.x}px`
      );
      this.style.setProperty(
        "--component-picker-y",
        `${this.#componentPickerConfiguration.y}px`
      );
      componentPicker = html`<div
        id="component-picker"
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
      >
        ${this.#componentPickerConfiguration.components.length
          ? html`<ul id="components">
              ${map(
                this.#componentPickerConfiguration.components,
                (kitContents) => {
                  const className = kitContents.id
                    .toLocaleLowerCase()
                    .replaceAll(/\W/gim, "-");
                  const id = kitContents.id;
                  const title = kitContents.metadata.title || id;
                  const icon = kitContents.metadata.icon ?? "generic";

                  return html`<li
                    class=${classMap({
                      [className]: true,
                      ["kit-item"]: true,
                    })}
                    draggable="true"
                    @click=${() => this.#handleChosenKitItem(id)}
                    @dragstart=${(evt: DragEvent) => {
                      if (!evt.dataTransfer) {
                        return;
                      }
                      evt.dataTransfer.setData(DATA_TYPE, id);
                    }}
                  >
                    <div
                      class=${classMap({
                        "node-icon": true,
                        [icon]: true,
                      })}
                    ></div>
                    <div>
                      <div class="node-id">${title}</div>
                    </div>
                  </li>`;
                }
              )}
            </ul>`
          : html`<div class="no-components-available">
              ${Strings.from("LABEL_NO_COMPONENTS")}
            </div>`}
      </div>`;
    }

    const content = html`<div id="content">
      ${this.graph && !this.readOnly
        ? html`<div id="floating-buttons">
            <div id="shelf">
              <button
                id="preset-all"
                class="expandable"
                ?disabled=${this.readOnly}
                @click=${async () => {
                  await storeReady;
                  this.showComponentLibrary = !this.showComponentLibrary;
                }}
              >
                ${Strings.from("LABEL_COMPONENT_LIBRARY")}
              </button>
              <button
                id="preset-a2"
                class="expandable"
                ?disabled=${this.readOnly}
                @click=${async (evt: PointerEvent) => {
                  if (!(evt.target instanceof HTMLButtonElement)) {
                    return;
                  }

                  await storeReady;
                  this.#showComponentPicker(evt.target, "A2");
                }}
              >
                ${Strings.from("LABEL_SHOW_LIST")}
              </button>
              <button
                id="preset-built-in"
                class="expandable"
                ?disabled=${this.readOnly}
                @click=${async (evt: PointerEvent) => {
                  if (!(evt.target instanceof HTMLButtonElement)) {
                    return;
                  }

                  await storeReady;
                  this.#showComponentPicker(evt.target, "Built-in Kit");
                }}
              >
                ${Strings.from("LABEL_SHOW_LIST")}
              </button>
              <button
                id="preset-tools"
                class="expandable"
                ?disabled=${this.readOnly}
                @click=${async (evt: PointerEvent) => {
                  if (!(evt.target instanceof HTMLButtonElement)) {
                    return;
                  }

                  await storeReady;
                  this.#showComponentPicker(evt.target, "Tool Kit");
                }}
              >
                ${Strings.from("LABEL_SHOW_LIST")}
              </button>
            </div>
            <div id="controls">
              <button
                id="zoom-to-fit"
                @click=${() => {
                  if (!this.#graphRendererRef.value) {
                    return;
                  }

                  let animate = true;
                  if (
                    window.matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                  ) {
                    animate = false;
                  }
                  this.#graphRendererRef.value.zoomToFit(animate);
                }}
              >
                Zoom to fit
              </button>
            </div>
          </div>`
        : nothing}
      ${componentLibrary} ${componentPicker}
      <bb-graph-renderer
        ${ref(this.#graphRendererRef)}
        .offsetZoom=${this.offsetZoom}
        .topGraphUrl=${this.graph?.raw().url ?? "no-url"}
        .topGraphResult=${this.topGraphResult}
        .run=${this.run}
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

    return [content, readOnlyFlag];
  }
}
