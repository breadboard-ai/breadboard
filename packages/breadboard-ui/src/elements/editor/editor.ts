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
  NodeDescriberResult,
  Schema,
  NodeConfiguration,
} from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import { NodeCreateEvent, NodeUpdateEvent } from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import { Graph, GraphRenderer } from "./graph-renderer.js";

const DATA_TYPE = "application/json";

type ActiveNode = {
  editAction: "add" | "update";
  id: string;
  type: string;
  inputSchema: Schema;
  configuration: NodeConfiguration;
};

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  nodeCount = 0;

  @property()
  edgeCount = 0;

  @property()
  editable = false;

  @state()
  activeNode: ActiveNode | null = null;

  #graph = new Graph();
  #graphRenderer = new GraphRenderer();
  #processing = false;
  #lastGraphUrl: string | null = null;
  #onDropBound = this.#onDrop.bind(this);

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

    #nodes {
      width: 100%;
      height: 100%;
      position: absolute;
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
    }
  `;

  reset() {
    // To be implemented.
  }

  async #processGraph(descriptor: GraphDescriptor) {
    if (this.#processing) {
      this.requestUpdate();
      return;
    }

    if (this.#lastGraphUrl !== descriptor.url) {
      // TODO: Notify the Graph Renderer to forget node locations.
    }
    this.#lastGraphUrl = descriptor.url || null;

    this.#processing = true;
    this.#graph.removeChildren();

    const breadboardGraph = inspect(descriptor, { kits: this.kits });
    // TODO: Remove once all the kit bits are settled.
    // For now, this is a good way to inspect all the kits.
    console.group("Kit inspection");
    for (const kit of breadboardGraph.kits()) {
      console.groupCollapsed(`Kit: ${kit.descriptor.title}`);
      for (const nodeType of kit.nodeTypes) {
        console.group("type", nodeType.type());
        console.log("ports", await nodeType.ports());
        console.groupEnd();
      }
      console.groupEnd();
    }
    console.groupEnd();

    this.#graph.edges = breadboardGraph.edges();
    this.#graph.nodes = breadboardGraph.nodes();
    this.#processing = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("drop", this.#onDropBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("drop", this.#onDropBound);
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          loadInfo: LoadArgs;
          nodeCount: number;
          edgeCount: number;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph =
      changedProperties.has("loadInfo") ||
      changedProperties.has("nodeCount") ||
      changedProperties.has("edgeCount");
    if (shouldProcessGraph && this.loadInfo && this.loadInfo.graphDescriptor) {
      this.#processGraph(this.loadInfo.graphDescriptor);
    }
  }

  #onDrop(evt: DragEvent) {
    evt.preventDefault();

    const data = evt.dataTransfer?.getData(DATA_TYPE);
    if (!data || !this.#graph) {
      console.warn("No data in dropped node");
      return;
    }

    const {
      kitItemName,
      inputSchema,
    }: { kitItemName: string; inputSchema: Schema } = JSON.parse(data);

    const nextNodeId = this.loadInfo?.graphDescriptor?.nodes.length || 1_000;
    const id = `${kitItemName}-${nextNodeId}`;

    // TODO: Request that the graph create a temporary node.

    this.activeNode = {
      editAction: "add",
      id,
      type: kitItemName,
      inputSchema,
      configuration: {},
    };
  }

  // TODO: Find a better way of getting the defaults for any given node.
  #getNodeMenu() {
    if (!this.editable) {
      return nothing;
    }

    const kitList = new Map<
      string,
      Map<string, Promise<NodeDescriberResult>>
    >();

    // Sort the kits by name.
    this.kits.sort((kit1, kit2) =>
      (kit1.title || "") > (kit2.title || "") ? 1 : -1
    );

    for (const kit of this.kits) {
      if (!kit.title) {
        continue;
      }

      const kitContents = new Map<string, Promise<NodeDescriberResult>>();
      for (const [name, handler] of Object.entries(kit.handlers)) {
        if (typeof handler === "object" && handler.describe) {
          kitContents.set(name, handler.describe());
        }
      }
      if (kitContents.size === 0) {
        continue;
      }

      kitList.set(kit.title, kitContents);
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
                ${map(kitContents, ([kitItemName, kitItem]) => {
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
                      const { inputSchema } = await kitItem;
                      if (!evt.dataTransfer) {
                        return;
                      }
                      evt.dataTransfer.setData(
                        DATA_TYPE,
                        JSON.stringify({
                          kitItemName,
                          inputSchema,
                        })
                      );
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

  #convertActiveNodeToForm(node: ActiveNode) {
    if (!node.inputSchema.properties) {
      return html`Unable to configure node - no schema provided.`;
    }

    return html`
      <div id="fields">
        <fieldset>
          <legend>ID</legend>
          <label for="$id">ID: <label>
          <input id="$id" name="id" type="text" value="${node.id}" />
        </fieldset>
        <fieldset>
          <legend>Configuration</legend>
          ${map(
            Object.entries(node.inputSchema.properties),
            ([name, schema]) => {
              let input;
              switch (schema.type) {
                case "object": {
                  input = `Object types are not supported yet.`;
                  break;
                }

                // TODO: Fill out more types.
                default: {
                  const value =
                    node.configuration[name] ??
                    schema.examples ??
                    schema.default ??
                    "";

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
            }
          )}
        </fieldset>
      </div>`;
  }

  #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement) || !this.activeNode) {
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

    const id = data.get("id") as string;
    const nodeType = data.get("$type") as string;
    if (!(id && nodeType)) {
      console.warn("Unable to configure node - ID and type are missing");
      return;
    }

    const configuration: NodeConfiguration = structuredClone(
      this.activeNode.configuration
    );
    for (const [name, value] of data) {
      if (typeof value !== "string") {
        continue;
      }

      if (name === "id" || name === "$type") {
        continue;
      }

      configuration[name] = value;
    }

    if (this.activeNode.editAction === "add") {
      this.dispatchEvent(new NodeCreateEvent(id, nodeType, configuration));
    } else {
      this.dispatchEvent(new NodeUpdateEvent(id, configuration));
    }

    // Close out the panel via removing the active node marker.
    this.activeNode = null;
  }

  firstUpdated(): void {
    this.#graphRenderer.addGraph(this.#graph);
  }

  render() {
    let activeNode: HTMLTemplateResult | symbol = nothing;
    if (this.activeNode) {
      activeNode = html`<div id="properties">
        <div id="node-properties">
          <form @submit=${this.#onFormSubmit}>
            <header>
              <button
                type="button"
                class="cancel"
                @click=${() => {
                  if (!(this.#graph && this.activeNode)) {
                    return;
                  }

                  // Remove the temporary node.
                  if (this.activeNode.editAction === "add") {
                    // TODO: Remove the temporary node
                  }

                  this.activeNode = null;
                }}
              >
                Cancel
              </button>
              <h1>
                Properties: ${this.activeNode.editAction}
                (${this.activeNode.id})
              </h1>

              <input
                type="hidden"
                name="$type"
                value="${this.activeNode.type}"
              />
              <input
                type="submit"
                value="${this.activeNode.editAction === "add"
                  ? "Add"
                  : "Update"}"
              />
            </header>
            ${this.#convertActiveNodeToForm(this.activeNode)}
          </form>
        </div>
      </div>`;
    }

    return html`<div id="nodes">${this.#graphRenderer}</div>
      ${activeNode} ${this.#getNodeMenu()}`;
  }
}
