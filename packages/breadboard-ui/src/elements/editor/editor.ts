/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LoadArgs } from "../../types/types.js";
import {
  inspect,
  GraphDescriptor,
  Kit,
  NodeConfiguration,
  InspectableNodePorts,
} from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import {
  EdgeChangeEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEdgeDetachEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import { GraphRenderer } from "./graph-renderer.js";
import { Graph } from "./graph.js";

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
  #lastGraphUrl: string | null = null;
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onResizeBound = this.#onResize.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
  #top = 0;
  #left = 0;

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

    #menu {
      position: absolute;
      top: 8px;
      left: 8px;
    }

    #menu ul {
      margin: 0;
      display: flex;
      flex-direction: column;
      list-style: none;
      font-size: var(--bb-text-small);
      color: #222;
      background: #fff;
      padding: calc(var(--bb-grid-size) * 2);
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      border-radius: 12px;
    }

    #menu li {
      margin-bottom: var(--bb-grid-size);
      white-space: nowrap;
    }

    #menu input[type="radio"] {
      display: none;
    }

    #menu li.kit-item,
    #menu label {
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 2);
      display: block;
      border-radius: 8px;
      background: #fff;
      border: 1px solid #bbb;
      border-radius: 8px;
    }

    #menu ul li:hover label {
      background: #dfdfdf;
    }

    #menu input[type="radio"]:checked ~ label {
      background: #ececec;
    }

    #menu input[type="radio"] ~ ul {
      display: none;
    }

    #menu input[type="radio"]:checked ~ ul {
      display: flex;
      flex-direction: column;
      position: absolute;
      left: calc(100% + var(--bb-grid-size));
      top: 0;
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

    if (this.#lastGraphUrl !== descriptor.url) {
      // TODO: Notify the Graph Renderer to forget node locations.
    }
    this.#lastGraphUrl = descriptor.url || null;

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

    window.addEventListener("resize", this.#onResizeBound);
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

    window.removeEventListener("resize", this.#onResizeBound);
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);

    super.disconnectedCallback();
  }

  protected updated(
    changedProperties:
      | PropertyValueMap<{
          loadInfo: LoadArgs;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph = changedProperties.has("loadInfo");

    if (shouldProcessGraph && this.loadInfo && this.loadInfo.graphDescriptor) {
      this.#processGraph(this.loadInfo.graphDescriptor);
    }
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

    const data = evt.dataTransfer?.getData(DATA_TYPE);
    if (!data || !this.#graph) {
      console.warn("No data in dropped node");
      return;
    }

    const nextNodeId =
      (this.loadInfo?.graphDescriptor?.nodes.length || 1_000) + 1;
    const id = `${data}-${nextNodeId}`;
    const x = evt.pageX - this.#left + window.scrollX;
    const y = evt.pageY - this.#top - window.scrollY;

    // Store the middle of the node for later.
    this.#graph.setNodeLayoutPosition(id, { x, y });

    this.dispatchEvent(new NodeCreateEvent(id, data));
  }

  #onResize() {
    const bounds = this.getBoundingClientRect();
    this.#top = bounds.top;
    this.#left = bounds.left;
  }

  // TODO: Find a better way of getting the defaults for any given node.
  #getNodeMenu() {
    if (!this.editable || !this.loadInfo || !this.loadInfo.graphDescriptor) {
      return nothing;
    }

    const graph = inspect(this.loadInfo.graphDescriptor, {
      kits: this.kits,
    });

    const kits = graph.kits() || [];
    const kitList = new Map<string, string[]>();
    kits.sort((kit1, kit2) =>
      (kit1.descriptor.title || "") > (kit2.descriptor.title || "") ? 1 : -1
    );

    for (const kit of kits) {
      if (!kit.descriptor.title) {
        continue;
      }

      kitList.set(
        kit.descriptor.title,
        kit.nodeTypes.map((node) => node.type())
      );
    }

    let selectedKit: string | null = null;
    return html`<div id="menu">
      <form>
        <ul>
          ${map(kitList, ([kitName, kitContents]) => {
            const kitId = kitName.toLocaleLowerCase().replace(/\W/, "-");
            return html`<li>
              <input
                type="radio"
                name="selected-kit"
                id="${kitId}"
                @click=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLInputElement)) {
                    return;
                  }

                  if (evt.target.id === selectedKit) {
                    evt.target.checked = false;
                    selectedKit = null;
                    return;
                  }

                  selectedKit = evt.target.id;
                }}
              /><label for="${kitId}">${kitName}</label>
              <ul>
                ${map(kitContents, (kitItemName) => {
                  const kitItemId = kitItemName
                    .toLocaleLowerCase()
                    .replace(/\W/, "-");
                  return html`<li
                    class=${classMap({
                      [kitItemId]: true,
                      ["kit-item"]: true,
                    })}
                    draggable="true"
                    @dragstart=${async (evt: DragEvent) => {
                      if (!evt.dataTransfer) {
                        return;
                      }
                      evt.dataTransfer.setData(DATA_TYPE, kitItemName);
                    }}
                  >
                    ${kitItemName}
                  </li>`;
                })}
              </ul>
            </li>`;
          })}
        </ul>
      </form>
    </div>`;
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

    return html`${this.#graphRenderer} ${this.#getNodeMenu()}`;
  }
}
