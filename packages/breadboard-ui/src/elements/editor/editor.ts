/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LoadArgs } from "../../types/types.js";
import {
  inspect,
  GraphDescriptor,
  Kit,
  NodeConfiguration,
  InspectableNodePorts,
} from "@google-labs/breadboard";
import {
  EdgeChangeEvent,
  FileDropEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEdgeDetachEvent,
  GraphNodeMoveEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
} from "../../events/events.js";
import { GraphRenderer } from "./graph-renderer.js";
import { Graph } from "./graph.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

const DATA_TYPE = "text/plain";

type EditedNode = {
  editAction: "add" | "update";
  id: string;
};

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property()
  boardId: number = -1;

  @property()
  kits: Kit[] = [];

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
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onResizeBound = this.#onResize.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onGraphNodeMoveBound = this.#onGraphNodeMove.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
  #top = 0;
  #left = 0;
  #addButtonRef: Ref<HTMLInputElement> = createRef();

  static styles = css`
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
      bottom: 72px;
      right: 16px;
    }

    #add-node {
      display: none;
    }

    label[for="add-node"] {
      position: absolute;
      bottom: 16px;
      right: 16px;
      border-radius: 50px;
      padding: 12px 16px;
      border: 1px solid #d9d9d9;
      background: #ffffff;
      cursor: pointer;
      opacity: 0.6;
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
  `;

  async #processGraph(descriptor: GraphDescriptor) {
    this.#graphVersion++;

    if (this.loadInfo && this.#lastBoardId !== this.boardId) {
      this.#graph.clearNodeLayoutPositions();
    }

    this.#lastBoardId = this.boardId;

    const breadboardGraph = inspect(descriptor, { kits: this.kits });
    const ports = new Map<string, InspectableNodePorts>();
    const graphVersion = this.#graphVersion;
    for (const node of breadboardGraph.nodes()) {
      ports.set(node.descriptor.id, await node.ports());
      if (this.#graphVersion !== graphVersion) {
        // Another update has come in, bail out.
        return;
      }
    }

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

    window.removeEventListener("resize", this.#onResizeBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);

    super.disconnectedCallback();
  }

  protected updated(
    changedProperties:
      | PropertyValueMap<{
          loadInfo: LoadArgs;
          kits: Kit[];
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph =
      changedProperties.has("loadInfo") || changedProperties.has("kits");

    if (
      shouldProcessGraph &&
      this.loadInfo &&
      this.loadInfo.graphDescriptor &&
      this.kits.length > 0
    ) {
      this.#processGraph(this.loadInfo.graphDescriptor);
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
    this.dispatchEvent(new NodeMoveEvent(id, x, y));
  }

  #onGraphEdgeAttach(evt: Event) {
    const { edge } = evt as GraphNodeEdgeAttachEvent;
    this.dispatchEvent(
      new EdgeChangeEvent("add", {
        from: edge.from.descriptor.id,
        to: edge.to.descriptor.id,
        out: edge.out,
        in: edge.in,
      })
    );
  }

  #onGraphEdgeDetach(evt: Event) {
    const { edge } = evt as GraphNodeEdgeDetachEvent;
    this.dispatchEvent(
      new EdgeChangeEvent("remove", {
        from: edge.from.descriptor.id,
        to: edge.to.descriptor.id,
        out: edge.out,
        in: edge.in,
      })
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
        },
        {
          from: toEdge.from.descriptor.id,
          to: toEdge.to.descriptor.id,
          out: toEdge.out,
          in: toEdge.in,
        }
      )
    );
  }

  #onGraphNodeDelete(evt: Event) {
    const { id } = evt as GraphNodeDeleteEvent;
    this.dispatchEvent(new NodeDeleteEvent(id));
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

    const randomId = globalThis.crypto.randomUUID();
    const nextNodeId = randomId.split("-");
    // TODO: Check for clashes
    const id = `${data}-${nextNodeId[0]}`;
    const x = evt.pageX - this.#left + window.scrollX;
    const y = evt.pageY - this.#top - window.scrollY;

    // Store the middle of the node for later.
    this.#graph.setNodeLayoutPosition(id, { x, y }, true);

    this.dispatchEvent(new NodeCreateEvent(id, data));
  }

  #onResize() {
    const bounds = this.getBoundingClientRect();
    this.#top = bounds.top;
    this.#left = bounds.left;
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

    return html`${this.#graphRenderer}
      <input
        ${ref(this.#addButtonRef)}
        name="add-node"
        id="add-node"
        type="checkbox"
      />
      <label for="add-node">Add</label>

      <bb-node-selector
        .loadInfo=${this.loadInfo}
        .kits=${this.kits}
      ></bb-node-selector>`;
  }
}
