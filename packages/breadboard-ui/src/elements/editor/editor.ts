/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  inspect,
  GraphDescriptor,
  Kit,
  NodeConfiguration,
  InspectableNodePorts,
  GraphLoader,
  SubGraphs,
  NodeDescriptor,
  NodeValue,
  Edge,
  EditSpec,
} from "@google-labs/breadboard";
import {
  EdgeChangeEvent,
  FileDropEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEdgeDetachEvent,
  GraphNodeMoveEvent,
  GraphNodesMoveEvent,
  KitNodeChosenEvent,
  MultiEditEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  SubGraphChosenEvent,
  SubGraphCreateEvent,
  SubGraphDeleteEvent,
} from "../../events/events.js";
import { GraphRenderer } from "./graph-renderer.js";
import { Graph } from "./graph.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { map } from "lit/directives/map.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import { EditorMode, filterPortsByMode } from "../../utils/mode.js";
import type { NodeSelector } from "./node-selector.js";
import { GraphEdge } from "./graph-edge.js";
import { edgeToString } from "./utils.js";

const DATA_TYPE = "text/plain";
const PASTE_OFFSET = 50;

type EditedNode = {
  editAction: "add" | "update";
  id: string;
};

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  subGraphId: string | null = "mySubgraph";

  @property()
  boardId: number = -1;

  @property()
  collapseNodesByDefault = false;

  @property()
  hideSubboardSelectorWhenEmpty = false;

  @property()
  showNodeShortcuts = true;

  @property()
  mode = EditorMode.ADVANCED;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property()
  editable = false;

  @property()
  highlightedNodeId: string | null = null;

  @state()
  nodeValueBeingEdited: EditedNode | null = null;

  @state()
  defaultConfiguration: NodeConfiguration | null = null;

  @property({ reflect: true })
  invertZoomScrollDirection = false;

  #graph = new Graph();
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
  #onGraphNodeMoveBound = this.#onGraphNodeMove.bind(this);
  #onGraphNodesMoveBound = this.#onGraphNodesMove.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
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
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 3);
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
  `;

  async #processGraph() {
    if (!this.graph) {
      return;
    }

    this.#graphVersion++;

    if (
      this.graph &&
      (this.#lastBoardId !== this.boardId ||
        this.#lastSubGraphId !== this.subGraphId)
    ) {
      this.#graph.clearNodeLayoutPositions();
      this.#graphRenderer.hideAllGraphs();
      this.#graphRenderer.zoomToFit();

      if (this.#lastSubGraphId !== this.subGraphId) {
        // TODO: Need to figure out how to encode the subgraph/node id combo.
        this.#graph.highlightedNodeId = null;
      }
    }
    this.#lastBoardId = this.boardId;
    this.#lastSubGraphId = this.subGraphId;

    let breadboardGraph = inspect(this.graph, {
      kits: this.kits,
      loader: this.loader || undefined,
    });

    if (this.subGraphId) {
      const subgraphs = breadboardGraph.graphs();
      if (subgraphs[this.subGraphId]) {
        breadboardGraph = subgraphs[this.subGraphId];
      } else {
        console.warn(`Unable to locate subgraph by name: ${this.subGraphId}`);
      }
    }

    const ports = new Map<string, InspectableNodePorts>();
    const graphVersion = this.#graphVersion;
    for (const node of breadboardGraph.nodes()) {
      ports.set(
        node.descriptor.id,
        filterPortsByMode(await node.ports(), this.mode)
      );
      if (this.#graphVersion !== graphVersion) {
        // Another update has come in, bail out.
        return;
      }
    }

    this.#graph.collapseNodesByDefault = this.collapseNodesByDefault;
    this.#graph.ports = ports;
    this.#graph.edges = breadboardGraph.edges();
    this.#graph.nodes = breadboardGraph.nodes();
  }

  connectedCallback(): void {
    this.#graphRenderer.addEventListener(
      GraphNodeEdgeAttachEvent.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeEdgeDetachEvent.eventName,
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
      GraphNodeMoveEvent.eventName,
      this.#onGraphNodeMoveBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodesMoveEvent.eventName,
      this.#onGraphNodesMoveBound
    );

    window.addEventListener("resize", this.#onResizeBound);
    this.addEventListener("keydown", this.#onKeyDownBound);
    this.addEventListener("pointermove", this.#onPointerMoveBound);
    this.addEventListener("pointerdown", this.#onPointerDownBound);
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);

    super.connectedCallback();
  }

  disconnectedCallback(): void {
    this.#graphRenderer.removeEventListener(
      GraphNodeEdgeAttachEvent.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeEdgeDetachEvent.eventName,
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
      GraphNodeMoveEvent.eventName,
      this.#onGraphNodeMoveBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodesMoveEvent.eventName,
      this.#onGraphNodesMoveBound
    );

    window.removeEventListener("resize", this.#onResizeBound);
    this.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);

    super.disconnectedCallback();
  }

  protected updated(
    changedProperties:
      | PropertyValueMap<{
          graph: GraphDescriptor | null;
          subGraphId: string | null;
          kits: Kit[];
          mode: EditorMode;
          collapseNodesByDefault: boolean;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph =
      changedProperties.has("graph") ||
      changedProperties.has("kits") ||
      changedProperties.has("subGraphId") ||
      changedProperties.has("mode") ||
      changedProperties.has("collapseNodesByDefault");

    if (shouldProcessGraph && this.graph && this.kits.length > 0) {
      this.#processGraph();
    }
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
    if (evt.metaKey && this.graph) {
      // Copy.
      if (evt.key === "c") {
        if (this.#writingToClipboard) {
          return;
        }

        const selected = this.#graph.getSelectedChildren();
        if (!selected.length) {
          return;
        }

        const nodes = this.graph.nodes.filter((node) => {
          return selected.find((item) => item.label === node.id);
        });

        const edges = this.graph.edges.filter((edge) => {
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

        this.#writingToClipboard = true;
        await navigator.clipboard.writeText(
          JSON.stringify(
            {
              title: this.graph.title,
              version: this.graph.version,
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

        this.#graph.deselectAllChildren();

        try {
          this.#readingFromClipboard = true;
          const data = await navigator.clipboard.readText();
          if (!data || !this.graph) {
            return;
          }

          const graph = JSON.parse(data) as GraphDescriptor;
          if (!("edges" in graph && "nodes" in graph)) {
            return;
          }

          graph.nodes.sort((nodeA: NodeDescriptor, nodeB: NodeDescriptor) => {
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
          });

          if (!graph.nodes.length) {
            return;
          }

          const leftMostNode = graph.nodes[0];
          let leftMostVisual = structuredClone(
            leftMostNode.metadata?.visual
          ) as Record<string, number>;
          if (!leftMostVisual) {
            leftMostVisual = { x: 0, y: 0 };
          }

          const leftMostNodeGlobalPosition = this.#graph.toGlobal({
            x: leftMostVisual.x,
            y: leftMostVisual.y,
          });

          const remappedNodeIds = new Map<string, string>();
          const edits: EditSpec[] = [];
          for (const node of graph.nodes) {
            if (!this.#isNodeDescriptor(node)) {
              continue;
            }

            // Update the node ID so it doesn't clash.
            const existingNode = this.graph.nodes.find(
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
            const x = (node.metadata.visual["x"] as number) ?? 0;
            const y = (node.metadata.visual["y"] as number) ?? 0;

            delete node.metadata.visual["x"];
            delete node.metadata.visual["y"];

            const globalPosition = this.#graph.toGlobal({ x, y });
            const offset = {
              x: globalPosition.x - leftMostNodeGlobalPosition.x,
              y: globalPosition.y - leftMostNodeGlobalPosition.y,
            };

            const position = {
              x: this.#lastX + offset.x - PASTE_OFFSET,
              y: this.#lastY + offset.y - PASTE_OFFSET,
            };

            this.#graph.setNodeLayoutPosition(node.id, position, false);
            this.#graph.addToAutoSelect(node.id);

            // Ask the graph for the visual positioning because the graph accounts for
            // any transforms, whereas our base x & y values do not.
            const layout = this.#graph.getNodeLayoutPosition(node.id) || {
              x: 0,
              y: 0,
            };
            node.metadata.visual.x = layout.x;
            node.metadata.visual.y = layout.y;

            edits.push({ type: "addnode", node });
          }

          const currentGraph = this.graph;
          if (!currentGraph) {
            return;
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

            const existingEdge = currentGraph.edges.find(
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

            this.#graph.addToAutoSelect(edgeToString(newEdge));
            edits.push({ type: "addedge", edge: newEdge, strict: true });
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

  #onGraphNodeMove(evt: Event) {
    const { id, x, y } = evt as GraphNodeMoveEvent;
    this.dispatchEvent(new NodeMoveEvent(id, x, y, this.subGraphId));
  }

  #onGraphNodesMove(evt: Event) {
    const moveEvt = evt as GraphNodesMoveEvent;
    const label = moveEvt.nodes.reduce((prev, curr, idx) => {
      return (
        prev +
        (idx > 0 ? ", " : "") +
        `(${curr.id}, {x: ${curr.x}, y: ${curr.y}})`
      );
    }, "");
    const editsEvt = new MultiEditEvent(
      moveEvt.nodes.map((node) => {
        return {
          type: "changemetadata",
          id: node.id,
          metadata: {
            visual: {
              x: node.x,
              y: node.y,
            },
          },
        };
      }),
      `Node multimove: ${label}`,
      this.subGraphId
    );

    this.dispatchEvent(editsEvt);
  }

  #onGraphEdgeAttach(evt: Event) {
    const { edge } = evt as GraphNodeEdgeAttachEvent;
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
    const { edge } = evt as GraphNodeEdgeDetachEvent;
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

  #onDragOver(evt: DragEvent) {
    evt.preventDefault();
  }

  #onDrop(evt: DragEvent) {
    evt.preventDefault();

    const [top] = evt.composedPath();
    if (!(top instanceof HTMLCanvasElement)) {
      return;
    }

    if (evt.dataTransfer?.files && evt.dataTransfer.files.length) {
      const fileDropped = evt.dataTransfer.files[0];
      try {
        fileDropped.text().then((data) => {
          const descriptor = JSON.parse(data) as GraphDescriptor;
          this.dispatchEvent(new FileDropEvent(fileDropped.name, descriptor));
        });
      } catch (err) {
        console.warn(err);
      }
      return;
    }

    const data = evt.dataTransfer?.getData(DATA_TYPE);
    if (!data || !this.#graph) {
      console.warn("No data in dropped node");
      return;
    }

    const id = this.#createRandomID(data);
    const x = evt.pageX - this.#left + window.scrollX;
    const y = evt.pageY - this.#top - window.scrollY;

    this.#graph.deselectAllChildren();

    // Store the middle of the node for later.
    this.#graph.setNodeLayoutPosition(id, { x, y }, true);

    // Ask the graph for the visual positioning because the graph accounts for
    // any transforms, whereas our base x & y values do not.
    const layout = this.#graph.getNodeLayoutPosition(id) || { x: 0, y: 0 };
    this.dispatchEvent(
      new NodeCreateEvent(id, data, this.subGraphId, undefined, {
        visual: { x: layout.x, y: layout.y },
      })
    );
  }

  #createRandomID(type: string) {
    const randomId = globalThis.crypto.randomUUID();
    const nextNodeId = randomId.split("-");
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
    this.#graphRenderer.addGraph(this.#graph);
  }

  render() {
    if (this.#graph) {
      this.#graph.highlightedNodeId = this.highlightedNodeId;
    }

    if (this.#graphRenderer) {
      this.#graphRenderer.editable = this.editable;
      this.#graphRenderer.invertZoomScrollDirection =
        this.invertZoomScrollDirection;
    }

    const subGraphs: SubGraphs | null =
      this.graph && this.graph.graphs ? this.graph.graphs : null;

    let showSubGraphSelector = true;
    if (
      this.hideSubboardSelectorWhenEmpty &&
      (!subGraphs || (subGraphs && Object.entries(subGraphs).length === 0))
    ) {
      showSubGraphSelector = false;
    }

    return html`${this.#graphRenderer}
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
        <label for="add-node">Nodes</label>

        <bb-node-selector
          ${ref(this.#nodeSelectorRef)}
          inert
          .graph=${this.graph}
          .kits=${this.kits}
          @bbkitnodechosen=${(evt: KitNodeChosenEvent) => {
            const id = this.#createRandomID(evt.nodeType);
            this.dispatchEvent(new NodeCreateEvent(id, evt.nodeType));
          }}
        ></bb-node-selector>

        ${this.showNodeShortcuts
          ? html`<div class="divider"></div>
              <button
                draggable="true"
                title="Add Specialist"
                id="shortcut-add-specialist"
                @dblclick=${() => {
                  const id = this.#createRandomID("specialist");
                  this.#graph.deselectAllChildren();
                  this.dispatchEvent(new NodeCreateEvent(id, "specialist"));
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
                title="Add human"
                id="shortcut-add-human"
                @dblclick=${() => {
                  const id = this.#createRandomID("human");
                  this.#graph.deselectAllChildren();
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
                title="Add looper"
                id="shortcut-add-looper"
                @dblclick=${() => {
                  const id = this.#createRandomID("looper");
                  this.#graph.deselectAllChildren();
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
              </button>`
          : nothing}
      </div>

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

            this.dispatchEvent(new SubGraphChosenEvent(evt.target.value));
          }}
        >
          <option
            ?selected=${this.subGraphId === null}
            value="${MAIN_BOARD_ID}"
          >
            Main board
          </option>
          ${map(Object.entries(subGraphs || []), ([subGraphId, subGraph]) => {
            return html`<option
              value="${subGraphId}"
              ?selected=${subGraphId === this.subGraphId}
            >
              ${subGraph.title || subGraphId}
            </option>`;
          })}
        </select>
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

            if (!confirm("Are you sure you wish to delete this sub board?")) {
              return;
            }

            this.dispatchEvent(new SubGraphDeleteEvent(this.subGraphId));
          }}
        >
          Delete sub board
        </button>
      </div>`
          : nothing}
      </div>`;
  }
}
