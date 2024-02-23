/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  html,
  css,
  PropertyValueMap,
  HTMLTemplateResult,
  nothing,
} from "lit";
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
  GraphNodeDblClickEvent,
  GraphNodeDelete,
  GraphNodeEdgeAttach,
  GraphNodeEdgeChange,
  GraphNodeEdgeDetach,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeUpdateEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import { GraphRenderer } from "./graph-renderer.js";
import { Graph } from "./graph.js";
import { until } from "lit/directives/until.js";

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

  #graph = new Graph();
  #graphRenderer = new GraphRenderer();
  // Incremented each time a graph is updated, used to avoid extra work
  // inspecting ports when the graph is updated.
  #graphVersion = 0;
  #lastGraphUrl: string | null = null;
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onResizeBound = this.#onResize.bind(this);
  #onGraphNodeDblClickBound = this.#onGraphNodeDblClick.bind(this);
  #onGraphEdgeAttachBound = this.#onGraphEdgeAttach.bind(this);
  #onGraphEdgeDetachBound = this.#onGraphEdgeDetach.bind(this);
  #onGraphEdgeChangeBound = this.#onGraphEdgeChange.bind(this);
  #onGraphNodeDeleteBound = this.#onGraphNodeDelete.bind(this);
  #top = 0;
  #left = 0;
  #expectingRefresh = false;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgb(244, 247, 252);
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

    #properties {
      background: rgba(0, 0, 0, 0.05);
      position: absolute;
      height: 100%;
      right: 0;
      top: 0;
      width: 100%;
      z-index: 10;
    }

    #node-properties {
      box-sizing: border-box;
      width: max(400px, 30%);
      position: absolute;
      height: 100%;
      right: 0;
      top: 0;
      background: #fff;
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      display: flex;
      flex-direction: column;
    }

    #properties header {
      display: flex;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 2);
      border-bottom: 1px solid rgb(227, 227, 227);
    }

    #properties h1 {
      padding: calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-text-small);
      font-weight: bold;
      margin: 0;
      position: sticky;
      top: 0;
      background: rgb(255, 255, 255);
      z-index: 1;
      flex: 1;
    }

    #properties form {
      display: grid;
      font-size: var(--bb-text-small);
      overflow: auto;
    }

    #properties #fields {
      overflow: auto;
      scrollbar-gutter: stable;
    }

    #properties fieldset {
      border-radius: 8px;
      border: 1px solid #ddd;
      margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2)
        calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 10);
      border: var(--bb-input-fieldset-border, 1px solid rgb(200, 200, 200));
      border-radius: var(--bb-grid-size);
      position: relative;
    }

    #properties legend {
      font-weight: bold;
      display: var(--bb-input-legend-display, block);
      padding: 0 calc(var(--bb-grid-size) * 2);
    }

    #properties label {
      grid-column: 1/3;
      font-family: var(--bb-font-family);
      font-size: var(--bb-text-small);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2) 0 0;
    }

    #properties div[contenteditable] {
      border-radius: var(
        --bb-input-border-radius,
        calc(var(--bb-grid-size) * 3)
      );
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
    }

    #properties .configuration-item {
      margin-bottom: calc(var(--bb-grid-size) * 2);
    }

    #properties input[type="submit"] {
      background: rgb(209, 203, 255);
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      border: none;
      padding: 0 var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
    }

    #properties .cancel {
      width: 24px;
      height: 24px;
      font-size: 0;
      border: none;
      background: no-repeat center center var(--bb-icon-close);
    }

    #form-controls {
      display: grid;
      column-gap: calc(var(--bb-grid-size) * 2);
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

    // Check that the active node is available.
    if (
      this.nodeValueBeingEdited &&
      !breadboardGraph.nodeById(this.nodeValueBeingEdited.id)
    ) {
      this.nodeValueBeingEdited = null;
    }

    this.#graph.ports = ports;
    this.#graph.edges = breadboardGraph.edges();
    this.#graph.nodes = breadboardGraph.nodes();
  }

  connectedCallback(): void {
    this.#graphRenderer.addEventListener(
      GraphNodeDblClickEvent.eventName,
      this.#onGraphNodeDblClickBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeEdgeAttach.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeEdgeDetach.eventName,
      this.#onGraphEdgeDetachBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeEdgeChange.eventName,
      this.#onGraphEdgeChangeBound
    );

    this.#graphRenderer.addEventListener(
      GraphNodeDelete.eventName,
      this.#onGraphNodeDeleteBound
    );

    window.addEventListener("resize", this.#onResizeBound);
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);

    super.connectedCallback();
  }

  disconnectedCallback(): void {
    this.#graphRenderer.removeEventListener(
      GraphNodeDblClickEvent.eventName,
      this.#onGraphNodeDblClickBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeEdgeAttach.eventName,
      this.#onGraphEdgeAttachBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeEdgeDetach.eventName,
      this.#onGraphEdgeDetachBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeEdgeChange.eventName,
      this.#onGraphEdgeChangeBound
    );

    this.#graphRenderer.removeEventListener(
      GraphNodeDelete.eventName,
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
          nodeCount: number;
          edgeCount: number;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph =
      changedProperties.has("loadInfo") || this.#expectingRefresh;

    this.#expectingRefresh = false;

    if (shouldProcessGraph && this.loadInfo && this.loadInfo.graphDescriptor) {
      console.log(this.loadInfo.graphDescriptor);
      this.#processGraph(this.loadInfo.graphDescriptor);
    }
  }

  #onGraphNodeDblClick(evt: Event) {
    const { id } = evt as GraphNodeDblClickEvent;
    this.nodeValueBeingEdited = {
      editAction: "update",
      id,
    };
  }

  #onGraphEdgeAttach(evt: Event) {
    const { edge } = evt as GraphNodeEdgeAttach;
    this.#expectingRefresh = true;
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
    const { edge } = evt as GraphNodeEdgeDetach;
    this.#expectingRefresh = true;
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
    const { fromEdge, toEdge } = evt as GraphNodeEdgeChange;
    this.#expectingRefresh = true;
    this.dispatchEvent(
      new EdgeChangeEvent("remove", {
        from: fromEdge.from.descriptor.id,
        to: fromEdge.to.descriptor.id,
        out: fromEdge.out,
        in: fromEdge.in,
      })
    );

    this.dispatchEvent(
      new EdgeChangeEvent("add", {
        from: toEdge.from.descriptor.id,
        to: toEdge.to.descriptor.id,
        out: toEdge.out,
        in: toEdge.in,
      })
    );
  }

  #onGraphNodeDelete(evt: Event) {
    const { id } = evt as GraphNodeDelete;
    this.#expectingRefresh = true;
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

    this.#expectingRefresh = true;
    this.dispatchEvent(new NodeCreateEvent(id, data));

    this.nodeValueBeingEdited = {
      editAction: "add",
      id,
    };
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

    return html`<div id="menu">
      <form>
        <ul>
          ${map(kitList, ([kitName, kitContents]) => {
            const kitId = kitName.toLocaleLowerCase().replace(/\W/, "-");
            return html`<li>
              <input type="radio" name="selected-kit" id="${kitId}" /><label
                for="${kitId}"
                >${kitName}</label
              >
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

  #createNodePropertiesPanel(activeNode: EditedNode) {
    if (!this.loadInfo || !this.loadInfo.graphDescriptor) {
      return;
    }

    const descriptor = this.loadInfo.graphDescriptor;
    const breadboardGraph = inspect(descriptor, { kits: this.kits });
    const node = breadboardGraph.nodeById(activeNode.id);
    if (!node) {
      return;
    }

    const configuration = node.configuration() || {};
    const details = (async () => {
      const { inputs } = await node.ports();
      return html` <div id="properties">
        <div id="node-properties">
          <form @submit=${this.#onFormSubmit}>
            <header>
              <button
                type="button"
                class="cancel"
                @click=${() => {
                  if (!this.#graph) {
                    return;
                  }

                  this.nodeValueBeingEdited = null;
                }}
              >
                Cancel
              </button>
              <h1>Properties: ${node.descriptor.type} (${node.title()})</h1>
              <input
                ?disabled=${!this.editable}
                type="submit"
                value="${activeNode.editAction === "add" ? "Add" : "Update"}"
              />
            </header>
            <div id="fields">
              <input
                id="$id"
                name="$id"
                type="hidden"
                value="${activeNode.id}"
              />
              <input
                id="$type"
                name="$type"
                type="hidden"
                value="${node.descriptor.type}"
              />
              <fieldset>
                <legend>Configuration</legend>
                ${map(inputs.ports, (port) => {
                  if (port.star) return;
                  const schema = port.schema || {};
                  const name = port.name;
                  const value =
                    configuration[name] ??
                    schema.examples ??
                    schema.default ??
                    "";

                  let input;
                  const type = port.schema?.type || "string";
                  switch (type) {
                    case "object": {
                      // TODO: Implement object editor.
                      // Use "format" to distinguish what type of "object",
                      // e.g. "format": "schema" for a JSON schema.
                      input = html`<div>
                        <textarea
                          style="height: 200px; width: 100%"
                          name="schema"
                        >
${JSON.stringify(value, null, 2)}</textarea
                        >
                      </div>`;
                      break;
                    }

                    // TODO: Fill out more types.
                    default: {
                      // prettier-ignore
                      input = html`<div
                            contenteditable="plaintext-only"
                            data-id="${name}"
                          >${value}</div>`;
                      break;
                    }
                  }

                  return html`<div class="configuration-item">
                    <label title="${schema.description}" for="${name}"
                      >${name}:
                    </label>
                    ${input}
                  </div>`;
                })}
              </fieldset>
            </div>
          </form>
        </div>
      </div>`;
    })();

    return html`${until(details, html`Loading...`)}`;
  }

  #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (
      !(evt.target instanceof HTMLFormElement) ||
      !this.nodeValueBeingEdited
    ) {
      return;
    }

    const data = new FormData(evt.target);
    for (const field of evt.target.querySelectorAll("div[contenteditable]")) {
      if (
        !(
          field instanceof HTMLDivElement &&
          field.dataset.id &&
          field.textContent
        )
      ) {
        continue;
      }

      data.set(field.dataset.id, field.textContent);
    }

    const id = data.get("$id") as string;
    const nodeType = data.get("$type") as string;
    if (!(id && nodeType)) {
      console.warn("Unable to configure node - ID and type are missing");
      return;
    }

    if (!this.loadInfo || !this.loadInfo.graphDescriptor) {
      return;
    }

    const descriptor = this.loadInfo.graphDescriptor;
    const breadboardGraph = inspect(descriptor, { kits: this.kits });
    const node = breadboardGraph.nodeById(id);
    if (!node) {
      return;
    }

    const configuration: NodeConfiguration =
      structuredClone(node.configuration()) || {};
    for (const [name, value] of data) {
      if (typeof value !== "string") {
        continue;
      }

      if (name === "$id" || name === "$type") {
        continue;
      }

      if (name === "schema") {
        configuration[name] = JSON.parse(value);
        continue;
      }

      configuration[name] = value;
    }

    console.log("New configuration", configuration);

    this.#expectingRefresh = true;
    this.dispatchEvent(new NodeUpdateEvent(id, configuration));

    // Close out the panel via removing the active node marker.
    this.nodeValueBeingEdited = null;
  }

  firstUpdated(): void {
    this.#onResizeBound();
    this.#graphRenderer.addGraph(this.#graph);
  }

  render() {
    let activeNode: HTMLTemplateResult | symbol = nothing;
    if (this.nodeValueBeingEdited) {
      activeNode = html`${this.#createNodePropertiesPanel(
        this.nodeValueBeingEdited
      )}`;
    }

    if (this.#graph) {
      this.#graph.highlightedNodeId = this.highlightedNodeId;
    }

    if (this.#graphRenderer) {
      this.#graphRenderer.editable = this.editable;
    }

    return html`${this.#graphRenderer} ${activeNode} ${this.#getNodeMenu()}`;
  }
}
