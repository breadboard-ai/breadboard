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
} from "@google-labs/breadboard";
import {
  EdgeChangeEvent,
  FileDropEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEdgeDetachEvent,
  GraphNodeMoveEvent,
  GraphNodePositionsCalculatedEvent,
  KitNodeChosenEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeMultiLayoutEvent,
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

const DATA_TYPE = "text/plain";

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

  #graph = new Graph();
  #graphRenderer = new GraphRenderer();
  // Incremented each time a graph is updated, used to avoid extra work
  // inspecting ports when the graph is updated.
  #graphVersion = 0;
  #lastBoardId: number = -1;
  #lastSubGraphId: string | null = null;
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onResizeBound = this.#onResize.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onGraphNodeMoveBound = this.#onGraphNodeMove.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
  #onGraphNodePositionsCalculatedBound =
    this.#onGraphNodePositionsCalculated.bind(this);
  #top = 0;
  #left = 0;
  #addButtonRef: Ref<HTMLInputElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ededed;
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
      right: 0;
    }

    #nodes {
      height: calc(var(--bb-grid-size) * 9);
      position: absolute;
      bottom: calc(var(--bb-grid-size) * 4);
      right: calc(var(--bb-grid-size) * 4);
      border-radius: 50px;
      border: 1px solid #d9d9d9;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 3);
    }

    #shortcut-add-superworker,
    #shortcut-add-human {
      font-size: 0;
      width: 20px;
      height: 20px;
      background: red;
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    #shortcut-add-superworker {
      background: var(--bb-icon-smart-toy) center center / 20px 20px no-repeat;
    }

    #shortcut-add-human {
      background: var(--bb-icon-human) center center / 20px 20px no-repeat;
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
      left: calc(var(--bb-grid-size) * 4);
      bottom: calc(var(--bb-grid-size) * 4);
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
      color: var(--bb-output-500);
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
      GraphNodePositionsCalculatedEvent.eventName,
      this.#onGraphNodePositionsCalculatedBound
    );

    window.addEventListener("resize", this.#onResizeBound);
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
      GraphNodePositionsCalculatedEvent.eventName,
      this.#onGraphNodePositionsCalculatedBound
    );

    window.removeEventListener("resize", this.#onResizeBound);
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
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph =
      changedProperties.has("graph") ||
      changedProperties.has("kits") ||
      changedProperties.has("subGraphId") ||
      changedProperties.has("mode");

    if (shouldProcessGraph && this.graph && this.kits.length > 0) {
      this.#processGraph();
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

  #onGraphNodePositionsCalculated(evt: Event) {
    const { layout } = evt as GraphNodePositionsCalculatedEvent;
    this.dispatchEvent(new NodeMultiLayoutEvent(layout, this.subGraphId));
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

    // Store the middle of the node for later.
    this.#graph.setNodeLayoutPosition(id, { x, y }, true);

    this.dispatchEvent(new NodeCreateEvent(id, data, this.subGraphId));
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
        />
        <label for="add-node">Nodes</label>

        <bb-node-selector
          .graph=${this.graph}
          .kits=${this.kits}
          @breadboardkitnodechosen=${(evt: KitNodeChosenEvent) => {
            const id = this.#createRandomID(evt.nodeType);
            this.dispatchEvent(new NodeCreateEvent(id, evt.nodeType));
          }}
        ></bb-node-selector>

        ${this.showNodeShortcuts
          ? html`<div class="divider"></div>
              <div
                draggable="true"
                title="Add superWorker"
                id="shortcut-add-superworker"
                @dblclick=${() => {
                  const id = this.#createRandomID("superWorker");
                  this.dispatchEvent(new NodeCreateEvent(id, "superWorker"));
                }}
                @dragstart=${(evt: DragEvent) => {
                  if (!evt.dataTransfer) {
                    return;
                  }
                  evt.dataTransfer.setData(DATA_TYPE, "superWorker");
                }}
              >
                Add superWorker
              </div>
              <div
                draggable="true"
                title="Add human"
                id="shortcut-add-human"
                @dblclick=${() => {
                  const id = this.#createRandomID("human");
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
              </div>`
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
            if (!confirm("Are you sure you want to reset node positions?")) {
              return;
            }

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
